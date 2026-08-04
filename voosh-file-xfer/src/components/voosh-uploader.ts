import "@awesome.me/webawesome/dist/components/copy-button/copy-button.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import { customElement, property, query, state } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import { css, CSSResultGroup, html, type PropertyValues } from "lit";
import { Utility } from "../base/Utility";
import { until } from "lit/directives/until.js";
import { VooshWebRtcClient } from "./voosh-webrtc-client";
import { constants } from "../base/Constants";

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
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        const explanationElement = this.explanation;
        setInterval(() => {
            if (this.hasAnyUserActivity) {
                if (this.noActivityTimer) {
                    clearTimeout(this.noActivityTimer);
                    this.noActivityTimer = undefined;
                    this.clearExplanation(explanationElement);
                }
                this.hasAnyUserActivity = false;
            } else if (!this.noActivityTimer) {
                this.noActivityTimer = setTimeout(() => this.showExplanation(explanationElement), 5_000);
            }
        }, 90);
        document.body.addEventListener('click', this.onReactToDocument(this.explanation));
        document.body.addEventListener('keyup', this.onReactToDocument(this.explanation));
    }

    showExplanation(element: HTMLParagraphElement | null) {
        let message = 'A Ref pertence à pessoa que quer receber o arquivo. ' +
        'Basta colar a Ref no campo da aba inicial <b>Receber arquivo</b>.';
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
        this.hasAnyUserActivity = true;
        return function() {
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
        document.body.removeEventListener('keyup', this.onReactToDocument(this.explanation));
        document.body.removeEventListener('click', this.onReactToDocument(this.explanation));
    }

    onSlideChanged() {
        this.shouldInitClient = true;
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
            <h3>Ref: <span aria-label="Ref!" class="ref">${this.ref}</span> <wa-copy-button tooltip-placement="right" value=${ until(Utility.getRef(this.file), "aguarde")}></wa-copy-button></h3>
        </p>`;
    }    
}
