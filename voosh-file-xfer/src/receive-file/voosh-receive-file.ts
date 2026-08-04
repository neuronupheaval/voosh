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
import { constants } from "../base/Constants";

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
    private readonly chunkSize = constants.chunkSizeInBytes;
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
        th {
            text-align: left;
            padding-right: auto;
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
            background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTA4MCIgem9vbUFuZFBhbj0ibWFnbmlmeSIgdmlld0JveD0iMCAwIDgxMCA4MDkuOTk5OTkzIiBoZWlnaHQ9IjEwODAiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIG1lZXQiIHZlcnNpb249IjEuMCI+PGRlZnM+PGNsaXBQYXRoIGlkPSI1YWNiMDUzZTJlIj48cGF0aCBkPSJNIDEgNzIuODk4NDM4IEwgODA5IDcyLjg5ODQzOCBMIDgwOSA1ODcgTCAxIDU4NyBaIE0gMSA3Mi44OTg0MzggIiBjbGlwLXJ1bGU9Im5vbnplcm8iLz48L2NsaXBQYXRoPjwvZGVmcz48ZyBjbGlwLXBhdGg9InVybCgjNWFjYjA1M2UyZSkiPjxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik0gMzY4LjMwNDY4OCAxNDYuMjkyOTY5IEMgMjY2Ljk3MjY1NiAxNDYuMjkyOTY5IDE4NC44MjQyMTkgMjI4LjQzNzUgMTg0LjgyNDIxOSAzMjkuNzY5NTMxIEMgMTg0LjgyNDIxOSAzNTAuMDM5MDYyIDE2OC4zOTQ1MzEgMzY2LjQ2ODc1IDE0OC4xMjg5MDYgMzY2LjQ2ODc1IEMgMTA3LjU5NzY1NiAzNjYuNDY4NzUgNzQuNzM4MjgxIDM5OS4zMjQyMTkgNzQuNzM4MjgxIDQzOS44NTkzNzUgQyA3NC43MzgyODEgNDgwLjM5NDUzMSAxMDcuNTk3NjU2IDUxMy4yNSAxNDguMTI4OTA2IDUxMy4yNSBMIDE5NCA1MTMuMjUgTCAxOTQgNTg2LjY0MDYyNSBMIDE0OC4xMjg5MDYgNTg2LjY0MDYyNSBDIDY3LjA2MjUgNTg2LjY0MDYyNSAxLjM0Mzc1IDUyMC45MjE4NzUgMS4zNDM3NSA0MzkuODU5Mzc1IEMgMS4zNDM3NSAzNzAuNzI2NTYyIDQ5LjEzNjcxOSAzMTIuNzU3ODEyIDExMy40ODA0NjkgMjk3LjE4NzUgQyAxMjkuNDkyMTg4IDE3MC43MDcwMzEgMjM3LjQ3NjU2MiA3Mi44OTg0MzggMzY4LjMwNDY4OCA3Mi44OTg0MzggQyA0NzEuNDI1NzgxIDcyLjg5ODQzOCA1NjAuMjg1MTU2IDEzMy42NDQ1MzEgNjAxLjE3OTY4OCAyMjEuMjQyMTg4IEMgNjA5LjA0Mjk2OSAyMjAuMjE0ODQ0IDYxNy4wNTA3ODEgMjE5LjY4MzU5NCA2MjUuMTc1NzgxIDIxOS42ODM1OTQgQyA3MjYuNTA3ODEyIDIxOS42ODM1OTQgODA4LjY1NjI1IDMwMS44MzIwMzEgODA4LjY1NjI1IDQwMy4xNjQwNjIgQyA4MDguNjU2MjUgNDUwLjUzNTE1NiA3OTQuODI4MTI1IDQ5Ni4wMDM5MDYgNzY2LjQxNDA2MiA1MzAuMzQ3NjU2IEMgNzM3LjQyMTg3NSA1NjUuMzkwNjI1IDY5NC45MTc5NjkgNTg2LjY0MDYyNSA2NDMuNTIzNDM4IDU4Ni42NDA2MjUgTCA2MTYgNTg2LjY0MDYyNSBMIDYxNiA1MTMuMjUgTCA2NDMuNTIzNDM4IDUxMy4yNSBDIDY3My4xOTE0MDYgNTEzLjI1IDY5NC45MTAxNTYgNTAxLjY0NDUzMSA3MDkuODY3MTg4IDQ4My41NjI1IEMgNzI1LjQwNjI1IDQ2NC43ODEyNSA3MzUuMjYxNzE5IDQzNi44NTU0NjkgNzM1LjI2MTcxOSA0MDMuMTY0MDYyIEMgNzM1LjI2MTcxOSAzNDIuMzYzMjgxIDY4NS45NzY1NjIgMjkzLjA3NDIxOSA2MjUuMTc1NzgxIDI5My4wNzQyMTkgQyA2MTIuODY3MTg4IDI5My4wNzQyMTkgNjAxLjEwMTU2MiAyOTUuMDgyMDMxIDU5MC4xNDQ1MzEgMjk4Ljc1MzkwNiBDIDU4MC43OTI5NjkgMzAxLjg5MDYyNSA1NzAuNTc0MjE5IDMwMS4xMzI4MTIgNTYxLjc4OTA2MiAyOTYuNjQ4NDM4IEMgNTUzLjAwMzkwNiAyOTIuMTY0MDYyIDU0Ni4zOTg0MzggMjg0LjMzMjAzMSA1NDMuNDUzMTI1IDI3NC45MTc5NjkgQyA1MjAuMTI1IDIwMC4zMzk4NDQgNDUwLjQ4MDQ2OSAxNDYuMjkyOTY5IDM2OC4zMDQ2ODggMTQ2LjI5Mjk2OSBaIE0gMzY4LjMwNDY4OCAxNDYuMjkyOTY5ICIgZmlsbC1vcGFjaXR5PSIxIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L2c+PHBhdGggZmlsbD0iI2ZmZmZmZiIgZD0iTSAzNjguMzA0Njg4IDQzOS44NTkzNzUgTCA0NDEuNjk1MzEyIDQzOS44NTkzNzUgTCA0NDEuNjk1MzEyIDY3OC4zODI4MTIgTCAzNjguMzA0Njg4IDY3OC4zODI4MTIgWiBNIDM2OC4zMDQ2ODggNDM5Ljg1OTM3NSAiIGZpbGwtb3BhY2l0eT0iMSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PHBhdGggZmlsbD0iI2ZmZmZmZiIgZD0iTSAzNzkuMDU0Njg4IDcyMi42NzU3ODEgTCAyNjguOTY4NzUgNjEyLjU4OTg0NCBMIDMyMC44NjMyODEgNTYwLjY5NTMxMiBMIDQwNS4wMDM5MDYgNjQ0LjgzNTkzOCBMIDQ4OS4xNDQ1MzEgNTYwLjY5NTMxMiBMIDU0MS4wMzkwNjIgNjEyLjU4OTg0NCBMIDQzMC45NTMxMjUgNzIyLjY3NTc4MSBDIDQxNi42MjEwOTQgNzM3LjAwNzgxMiAzOTMuMzg2NzE5IDczNy4wMDc4MTIgMzc5LjA1NDY4OCA3MjIuNjc1NzgxIFogTSAzNzkuMDU0Njg4IDcyMi42NzU3ODEgIiBmaWxsLW9wYWNpdHk9IjEiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==');
            background-repeat:no-repeat;
            background-size: contain;
            display: inline-block;
            width: 20px;
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
                }}><span class="icon" role="img">\u00a0</span><span role="listitem">${++countClone.value}</span></button>`,
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
        const thead = [ html`número`, html`nome do arquivo`, html`tamanho`, html`tags` ];
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
