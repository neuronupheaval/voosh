import "@awesome.me/webawesome/dist/components/copy-button/copy-button.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import { customElement, property, query, state } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import { css, CSSResultGroup, html, type PropertyValues } from "lit";
import { Utility } from "../base/Utility";
import { until } from "lit/directives/until.js";
import { VooshWebRtcClient } from "./voosh-webrtc-client";
import { constants } from "../base/Constants";

var reloadButtonTimer: ReturnType<typeof setTimeout>;

@customElement("voosh-uploader")
export class VooshUploader extends BaseElement {
    sender?: VooshWebRtcClient;

    @property({ attribute: false, type: Object })
    file?: File;

    @property()
    tags: string[] = [];

    @property()
    ref?: string;

    @state()
    title: string = "Informe ao baixador";
    
    @state()
    shouldInitClient = false;
    
    percent: number = 0;
    timer?: ReturnType<typeof setTimeout>;

    @state()
    private fileOffset = 0;
    private readonly chunkSize = constants.chunkSizeInBytes;

    @state()
    private hasAnyUserActivity: Boolean | null = null;
    private noActivityTimer?: ReturnType<typeof setTimeout>;

    @query('#explanation') private readonly explanation!: HTMLParagraphElement | null;

    static override styles?: CSSResultGroup | undefined = css`
        .ref {
            font-size: 1.75em;
            font-family: "Lucida Console", "Courier New", monospace;
        }
        #explanation {
            font-color: #000;
            padding: 20px;
            border: 6px dashed #ccc;
            border-radius: 20px;
            opacity: 0;
        }
        .button-container {
            padding-top: 18px;
            display: none;
            opacity: '0';
            text-align: center;
        }
`;

    protected willUpdate(_changedProperties: PropertyValues): void {
        const self = this;

        if (_changedProperties.has("file")) {
            console.log(`old file name = ${_changedProperties.get("file")?.name}, new file name = ${this.file?.name}`);
        }
        if (this.shouldInitClient) {
            this.shouldInitClient = false;
            this.sender = new VooshWebRtcClient(() => import.meta.env.VITE_SIGNALING_ENDPOINT_URL)
                .onUpload((ref, sender) => this.onUpload(ref, sender))
                .onP2PHandler("ack", (_, __, context) => self.sendFile(context))
                .prepare();
        }
        if (this.file && this.fileOffset >= this.file.size) {
            this.showReloadButton();
        }
    }

    showExplanation(element: HTMLParagraphElement | null) {
        let message = 'A Ref abaixo é para a pessoa que receberá o arquivo. ' +
        'Mande para ela uma mensagem de Whatsapp com a Ref e ' +
        'diga para colar em <i>Receber arquivo</i>.';
        this.prepareAndShowExplanation(message, element);
    }

    prepareAndShowExplanation(message: string, element: HTMLParagraphElement | null) {
        if (element) {
            element.innerHTML = message;
            element.style.transition = 'opacity 1.1s ease';
            element.style.opacity = '0.7';
        } else {
            console.log("elmeent is null");
        }
    }

    onReactToDocument(element: HTMLParagraphElement | null) {
        const self = this;
        return function() {
            self.hasAnyUserActivity = true;
            self.clearExplanation(element);
        };
    }

    clearExplanation(element: HTMLParagraphElement | null) {
        if (element && element.textContent) {
            element.style.transition = 'opacity 0.4s ease';
            element.style.opacity = '0';
            setTimeout(() => element.innerHTML = '&nbsp;', 400);
        } else {
            console.log('element is nullish');
        }
    }

    disconnectedCallback(): void {
        this.sender
            ?.onUpload(undefined)
            ?.offP2PHandler("ack");
        this.sender = undefined;
    }

    onSlideChanged() {
        this.shouldInitClient = true;
        const element = this.explanation;
        setInterval(() => {
            if (this.hasAnyUserActivity === true) {
                console.warn('itz true');
            }
            if (this.hasAnyUserActivity) {
                this.hasAnyUserActivity = false;
                if (this.noActivityTimer) {
                    clearTimeout(this.noActivityTimer);
                    this.noActivityTimer = undefined;
                    this.clearExplanation(element);
                }
            } else if (!this.noActivityTimer) {
                this.noActivityTimer = setTimeout(() => this.showExplanation(element), 5_000);
            }
        }, 90);
        document.body.addEventListener('click', this.onReactToDocument(element));
        document.body.addEventListener('keyup', this.onReactToDocument(element));
    }

    showReloadButton() {
        const buttonContainer = (this.shadowRoot || this).querySelector(".button-container") as HTMLDivElement;
        buttonContainer.style.display = 'block';
        buttonContainer.style.transition = 'opacity 0.8s ease';
        buttonContainer.style.opacity = '1';
        const button = buttonContainer.querySelector(".btn") as HTMLButtonElement;
        let count = 5;
        reloadButtonTimer = (function loop () {
            return setTimeout(() => {
                if (count >= 0) {
                    button.textContent = 'Recarregando em ' + (count--) + 's...';
                    reloadButtonTimer = loop();
                } else {
                    button.click();
                }
            }, 1_000);
        })();
    }

    async sendFile(context: { sendMessage(payload: any): void }) {
        const titleMessage = "Subindo arquivo";
        if (this.title !== titleMessage) {
            this.title = titleMessage;
        }

        const file = this.file!;
        const size = this.file!.size;
        const chunkSize = this.chunkSize;
        
        let chunkCounter = 0;
        let newOffset = this.fileOffset;

        while (newOffset < size && chunkCounter++ < 10) {
            console.info(` ${newOffset} before, iteration #${chunkCounter}`);

            const slice = file.slice(newOffset, newOffset + chunkSize);
            const buffer = await slice.arrayBuffer();
            const chunk = new Uint8Array(buffer);
            const binaryString = String.fromCodePoint(...chunk);

            newOffset += chunk.length;
            
            context.sendMessage({
                type: "chunk",
                payload: btoa(binaryString)
            });

            console.info(` ${newOffset} after, iteration #${chunkCounter}`);
        }

        this.fileOffset = newOffset;
        this.requestUpdate();
    }

    async onUpload(ref: string, sender: string) {
        console.info(`ref = ${ref}, sender = ${sender}`);

        this.setTogglingTitle("Consulta de interessado(a) em andamento", 15_000);
        if (ref === await Utility.getRef(this.file)) {
            console.log(`file name: [${this.file!.name}], file size: [${this.file!.size}]`);
            return { sender: sender, fileName: this.file!.name, fileSize: this.file!.size, tags: this.tags };
        } else {
            return undefined;
        }
    }

    setTogglingTitle(newTitle: string, timeoutInMs: number) {
        const oldTitle = this.title;
        this.title = newTitle;
        this.timer = setTimeout(() => this.title = oldTitle, timeoutInMs);
    }

    render() {        
        this.percent = Math.ceil(this.fileOffset / (this.file?.size ?? 1.000) * 100.000);

        return html`<h2>${this.title}</h2>
        <p id="explanation">&nbsp;</p>
        ${
            this.percent === 0
            ? html``
            : html`<wa-progress-bar id="progress-bar" .value=${this.percent}>
                ${this.percent >= 100.0 ? html`finalizado` : html`${this.percent}%`}
                </wa-progress-bar>`
        }
        <p id="board">
            <h3>Ref: <span aria-label="Ref!" class="ref">${this.ref}</span> <wa-copy-button tooltip-placement="right" 
            copy-label="Copiar" success-label="Copiado!" error-label="ERRO" value=${ until(Utility.getRef(this.file), "aguarde")}></wa-copy-button></h3>
        </p>
        <div class="button-container"><button class="btn" @click="${() => {
            clearTimeout(reloadButtonTimer); 
            location.reload();
        }}"></button></div>`;
    }    
}
