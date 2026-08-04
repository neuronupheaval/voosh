import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/tag/tag.js";
import { customElement, property, query, state } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import { css, CSSResultGroup, html, nothing, PropertyValues } from "lit";
import { type RefMatchedResponse, VooshWebRtcClient } from "../components/voosh-webrtc-client";
import { when } from "lit/directives/when.js";
import { repeat } from "lit/directives/repeat.js";
import type WaButton from "@awesome.me/webawesome/dist/components/button/button.js"; 

@customElement("voosh-receive-file")
export class VooshReceiveFile extends BaseElement {
    @property({ type: String })
    ref?: string;

    @property({ type: Boolean })
    confirm: boolean = true;

    @state()
    table: any[][] = [];

    @state()
    shouldInitClient = false;

    @state({ hasChanged(newValue, oldValue) {
        const n = (newValue as any)?.value;
        const o = (oldValue as any)?.value;
        return n !== o;
    }})
    count = { value: 0 };
    
    @state()
    private fileOffset = 0;

    @state()
    private statusMessage = "";

    @state()
    private hasAnyUserActivity: Boolean | null = null;
    private noActivityTimer?: ReturnType<typeof setInterval>;

    @query('#explanation')
    private readonly explanation!: HTMLParagraphElement | null;

    private fileName?: { value: string; };
    private fileSize?: { value: number };
    private readonly chunkSize = 1_024;
    private opfsFile?: FileSystemFileHandle;
    private opfsWriter?: FileSystemWritableFileStream;
    private isWriterClosing = false;
    private chunkCount = 0;
    
    private shouldUpdateUI = { value: false };

    static override styles?: CSSResultGroup | undefined = css`
        .ref {
            font-size: 1.75em;
            font-family: "Lucida Console", "Courier New", monospace;
        }
        table, th, td {
            border: 1px solid var(--wa-color-neutral-300, #ccc);
            border-collapse: collapse;
        }
        td {
            text-align: right;
            padding: 12px;
        }
        .dl-icon {
            width: 3.9em;
            aspect-ratio: 16/9;
        }   
        #explanation {
            padding: 20px;
            border: 6px dashed #ccc;
            border-radius: 20px;
            opacity: 0;
        }
        .download {
            display: inline-block;
            padding: 12px 24px;
            cursor: pointer;
            background: linear-gradient(135deg, #6e8efb, #a777e3);
            color: white;
            font-weight: bold;
            border-radius: 30px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .download:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        .download:active {
            transform: translateY(0);
        }
        .icon {
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjRweCIgaGVpZ2h0PSI2NHB4IiB2aWV3Qm94PSItMi40IC0yLjQgMjguODAgMjguODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwMDAwIj48ZyBpZD0iU1ZHUmVwb19iZ0NhcnJpZXIiIHN0cm9rZS13aWR0aD0iMCIvPjxnIGlkPSJTVkdSZXBvX3RyYWNlckNhcnJpZXIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlPSIjZjI4MDAwZmZmZmYiIHN0cm9rZS13aWR0aD0iMi40OTYiPjxwYXRoIGQ9Ik0xMiAxMlYxOU0xMiAxOUw5Ljc1IDE2LjY2NjdNMTIgMTlMMTQuMjUgMTYuNjY2N002LjYgMTcuODMzM0M0LjYxMTc4IDE3LjgzMzMgMyAxNi4xOTE3IDMgMTQuMTY2N0MzIDEyLjQ5OCA0LjA5NDM4IDExLjA4OTcgNS41OTE5OCAxMC42NDU3QzUuNjU1NjIgMTAuNjI2OCA1LjcgMTAuNTY3NSA1LjcgMTAuNUM1LjcgNy40NjI0MyA4LjExNzY2IDUgMTEuMSA1QzE0LjA4MjMgNSAxNi41IDcuNDYyNDMgMTYuNSAxMC41QzE2LjUgMTAuNTU4MiAxNi41NTM2IDEwLjYwMTQgMTYuNjA5NCAxMC41ODg3QzE2Ljg2MzggMTAuNTMwNiAxNy4xMjg0IDEwLjUgMTcuNCAxMC41QzE5LjM4ODIgMTAuNSAyMSAxMi4xNDE2IDIxIDE0LjE2NjdDMjEgMTYuMTkxNyAxOS4zODgyIDE3LjgzMzMgMTcuNCAxNy44MzMzIiBzdHJva2U9IiNmMjgwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvZz48ZyBpZD0iU1ZHUmVwb19pY29uQ2FycmllciI+PHBhdGggZD0iTTEyIDEyVjE5TTEyIDE5TDkuNzUgMTYuNjY2N00xMiAxOUwxNC4yNSAxNi42NjY3TTYuNiAxNy44MzMzQzQuNjExNzggMTcuODMzMyAzIDE2LjE5MTcgMyAxNC4xNjY3QzMgMTIuNDk4IDQuMDk0MzggMTEuMDg5NyA1LjU5MTk4IDEwLjY0NTdDNS42NTU2MiAxMC42MjY4IDUuNyAxMC41Njc1IDUuNyAxMC41QzUuNyA3LjQ2MjQzIDguMTE3NjYgNSAxMS4xIDVDMTQuMDgyMyA1IDE2LjUgNy40NjI0MyAxNi41IDEwLjVDMTYuNSAxMC41NTgyIDE2LjU1MzYgMTAuNjAxNCAxNi42MDk0IDEwLjU4ODdDMTYuODYzOCAxMC41MzA2IDE3LjEyODQgMTAuNSAxNy40IDEwLjVDMTkuMzg4MiAxMC41IDIxIDEyLjE0MTYgMjEgMTQuMTY2N0MyMSAxNi4xOTE3IDE5LjM4ODIgMTcuODMzMyAxNy40IDE3LjgzMzMiIHN0cm9rZT0iI2YyODAwMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9nPjwvc3ZnPg==');
            background-repeat:no-repeat;
            background-size: contain;
            display: inline-block;
            width: 18px;
            height: 18px;
            margin: 0 6px;
        }
`;

    disconnectedCallback(): void {
        clearInterval(this.noActivityTimer);
        super.disconnectedCallback();
    }

    protected updated(_changedProperties: PropertyValues): void {
        if (_changedProperties.has("confirm") && this.confirm) {
            console.log("passei 1");
            document.body.addEventListener('click', this.onReactToDocument(this.explanation));
            document.body.addEventListener('keyup', this.onReactToDocument(this.explanation));
        } else if (_changedProperties.has("confirm") && !this.confirm) {
            console.log("passei 2");
            document.body.removeEventListener('keyup', this.onReactToDocument(this.explanation));
            document.body.removeEventListener('click', this.onReactToDocument(this.explanation));
        }
    }

    onExpand() {
        console.log("voosh-receive-file got onExpand");
        this.triggerVooshIsUploadEvent();

        if (!this.noActivityTimer) {
            this.onFirstTimeExpansion();
        }
    }

    onReactToDocument(explanation: HTMLParagraphElement | null) {
        this.hasAnyUserActivity = true;
        return function() {
            if (explanation) {
                explanation.style.transition = 'opacity 0.4s ease';
                explanation.style.opacity = '0';
                setTimeout(() => explanation.innerText = '', 400);
            } else {
                console.log('explanation is null');
            }
        }.bind(this);
    }

    triggerVooshIsUploadEvent() {
        const event = new CustomEvent('voosh-is-upload', {
            detail: { value: false /**This is not an upload component*/},
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    onFirstTimeExpansion() {
        this.noActivityTimer = setInterval(() => {
            if (this.confirm) {
                if (this.hasAnyUserActivity !== false) {
                    this.hasAnyUserActivity = false;
                } else if (this.hasAnyUserActivity === false) {
                    const explanationElement = this.explanation!;
                    explanationElement.innerText = 'Cole ou digite a Ref na caixa acima. A Ref é fornecida pela pessoa que enviará o arquivo. Depois disso, aperte Barra de Espaços.';
                    explanationElement.style.transition = 'opacity 1.1s ease';
                    explanationElement.style.opacity = '0.7';
                }
            }
        }, 5_000);
    }

    clearExplanation() {
        clearInterval(this.noActivityTimer);
        const explanationElement = this.explanation!;
        explanationElement.style.transition = 'opacity 0.4s ease';
        explanationElement.style.opacity = '0';
        setTimeout(() => explanationElement.textContent = '', 400);
    }

    onDownloadCandidate(context: { download(): void }, details: RefMatchedResponse) {
        console.log("populating table");
        if (this.noActivityTimer) {
            this.clearExplanation();
        }
        const countClone = structuredClone(this.count);
        this.table = [ ...this.table,
            [ html`<button class="download" title="Clique pra baixar" @click=${(e: MouseEvent) => {
                    this.statusMessage = 'O download começa em breve';
                    const button = e.target as WaButton;
                    button.disabled = true;
                    button.style.opacity = '0.1';
                    this.fileName = { value: details.fileName };
                    this.fileSize = { value: details.fileSize };
                    const trs = this.shadowRoot!.querySelectorAll(`tr:not(:has(th)):not([voosh-sender='${details.sender}'])`);
                    for (let i = 0; i < trs.length; ++i) {
                        const tr = trs[i] as HTMLTableRowElement;
                        tr.style.transition = "opacity 0.8s ease";
                        tr.style.opacity = "0";
                        setTimeout(() => tr.remove(), 800);
                    }
                    context.download();
                }}><span class="icon">\u00a0</span>${++countClone.value}</button>`,
                html`${details.fileName}`,
                html`${Intl.NumberFormat(undefined, {maximumFractionDigits:0}).format(details.fileSize)}`,
                html`${details.tags?.map(tag => html`<wa-tag variant="neutral" appearance="filled">${tag}</wa-tag>`)}`,
                details.sender
            ]
        // Remove duplicates
        ].filter((row, index, self) => self.findIndex(r => r[4] === row[4]) === index);

        this.count = countClone;
        this.shouldUpdateUI.value = true;
        console.log(`  this.count.value after onDownloadCandidate(): ${this.count.value}`);
    }

    private onWelcome(_: string, __: any, context: {
        sendMessage: (payload: any) => void
    }): void {
        this.prepareDownloadChannel();
        setTimeout(() => context.sendMessage({ type: "ack" }), 1_200);
    }

    private async onChunk(_: string, payload: any, context: {
        sendMessage: (payload: any) => void,
        abortChannel: () => void
    }): Promise<void> {
        if (!this.opfsFile || !this.opfsWriter) {
            console.warn("pipeline not prepared. call prepareDownloadChannel() first. or channel has been close.");
            return;
        }

        if (this.isWriterClosing) {
            console.warn("opfs writer cannot write as it is closing/closed");
            return;
        }

        const rawBinary = atob(payload);
        const chunk = Uint8Array.from(rawBinary, c => c.charCodeAt(0));
        await this.opfsWriter.write(chunk);

        this.fileOffset += chunk.length;
        if (++this.chunkCount >= 10) {
            this.chunkCount = 0;
            context.sendMessage({
                type: "ack"
            });
        }

        if (!this.isWriterClosing && this.fileOffset >= this.fileSize!.value) {
            this.isWriterClosing = true;

            await this.opfsWriter.close();
            const finalizedFile = await this.opfsFile.getFile();
            this.triggerNativeDownload(finalizedFile);

            this.opfsFile = this.opfsWriter = undefined;

            console.log("download complete");
            context.abortChannel();
        }

        console.info(` ${this.chunkCount}/10 chunks in this cycle, file offset ${this.fileOffset}`)
    }

    private triggerNativeDownload(file: File) {
        const downloadUrl = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = this.fileName!.value;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    onRefInput(e: InputEvent) {
        const value = (e.target as HTMLInputElement).value;
        if (value && value.trim().length > 0 && value.endsWith(' ')) {
            this.ref = value.trim();
            console.log(`user has stroke magic key with ref [${this.ref}]`);
            // Initialize state machine.
            this.onInit();
            console.log("onInit has finished");
        }
    }

    onInit() {
        this.table = [];
        this.count.value = 0;

        new VooshWebRtcClient(() => import.meta.env.VITE_SIGNALING_ENDPOINT_URL)
            .onDownload((context, payload) => this.onDownloadCandidate(context, payload))
            .onP2PHandler("welcome", async (type, payload, context) => await this.onWelcome.bind(this)(type, payload, context))
            .onP2PHandler("chunk", async (type, payload, context) => await this.onChunk.bind(this)(type, payload, context))
            .prepare()
            .sendRef(this.ref!);
    }

    async prepareDownloadChannel() {
        const root = await navigator.storage.getDirectory();
        this.opfsFile = await root.getFileHandle(`temp_${Date.now()}_${this.ref!}_${this.fileName!}`, { create: true });
        this.opfsWriter = await this.opfsFile.createWritable();
        this.fileOffset = 0;

        console.log(`opfs local sandbox file is mapped and ready`);
    }

    render() {
        const thead = [ html`número`, html`nome do arquivo`, html`tamanho`, html`tags`, html`&nbsp;` ];
        const percent = Math.ceil(this.fileOffset / (this.fileSize?.value ?? 1.000) * 100.000)
        return when(this.confirm, 
            () => html`<wa-input label="Digite Ref"
            appearance="filled-outlined" size="m" pill maxlength="8" @input=${this.onRefInput}></wa-input>
            <p id="explanation"></p>
            <table class="wa-zebra-rows wa-hover-rows wa-tabular-nums" width="100%">
        ${this.count.value > 0 ? repeat(
            [ thead, ...this.table ],
            (_, rowIndex) => rowIndex, // Row key
            (row, rowIndex) =>
              html`<tr voosh-sender="${row[4]}">
                ${repeat(
                  row,
                  (_, colIndex) => `${rowIndex}-${colIndex}`, // Cell key
                  (cell, colIndex) => {
                        if (colIndex === 4) return nothing;
                        return rowIndex === 0 ? html`<th>${cell}</th>` : html`<td>${cell}</td>`;
                })}
              </tr>`
        ) : html``}
        </table>
        <div>&nbsp;</div>
        ${
            percent == 0
            ? this.statusMessage
            : html`<wa-progress-bar id="progress-bar" .value=${percent}>
                ${percent >= 100.0 ? html`finalizado` : html`${percent}%`}
                </wa-progress-bar>`
        }`,
        () => html`not ready`)
    }
}
