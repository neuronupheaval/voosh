import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import { customElement, property, state } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import { css, CSSResultGroup, html, type TemplateResult } from "lit";
import { type RefMatchedResponse, VooshWebRtcClient } from "../components/voosh-webrtc-client";
import type WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
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
        }`;

    onExpand() {
        console.log("voosh-receive-file got onExpand");
        this.triggerVooshIsUploadEvent();
    }

    triggerVooshIsUploadEvent() {
        const event = new CustomEvent('voosh-is-upload', {
            detail: { value: false /**This is not an upload component*/},
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    onDownloadCandidate(context: { download(): void }, details: RefMatchedResponse) {
        console.log("populating table");

        const countClone = structuredClone(this.count);
        const self = this;
        this.table = [ ...this.table,
            [ html`${++countClone.value}`,
                html`${details.fileName}`,
                html`${Intl.NumberFormat(undefined, {maximumFractionDigits:0}).format(details.fileSize)}`,
                html`${details.tags?.join(", ")}`,
                html`<wa-button size="s" @click=${(e: MouseEvent) => {
                    (e.target as WaButton).disabled = true;
                    self.fileName = { value: details.fileName };
                    self.fileSize = { value: details.fileSize };
                    const trs = this.shadowRoot!.querySelectorAll(`tr:has(td:nth-child(6):not([voosh-sender='${details.sender}']))`);
                    for (let i = 0; i < trs.length; ++i) {
                        const tr = (trs[i] as HTMLTableRowElement)
                        tr.style.transition = "opacity 0.8s ease";
                        tr.style.opacity = "0";
                        setTimeout(() => tr.remove(), 800);
                    }
                    context.download();
                }}><wa-icon name="arrow-down" style="font-size: 1rem; color: mediumseagreen;"></button>`,
                details.sender
            ]
        // Remove duplicates
        ].filter((row, index, self) => self.findIndex(r => r[5] == row[5]) === index);

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
        const percent = Math.ceil(this.fileOffset / (this.fileSize?.value ?? 1.000) * 100.000);

        console.log(`render  this.count.value = ${this.count.value}`);

        return when(this.confirm, 
            () => html`<wa-input label="Digite Ref"
            appearance="filled-outlined" size="m" pill maxlength="8" @input=${this.onRefInput}></wa-input>
            <div>&nbsp;</div>
            <table class="wa-zebra-rows wa-hover-rows wa-tabular-nums" width="100%">
        ${this.count.value > 0 ? repeat(
            [ thead, ...this.table ],
            (_, rowIndex) => rowIndex, // Row key
            (row, rowIndex) =>
              html`<tr>
                ${repeat(
                  row,
                  (_, colIndex) => `${rowIndex}-${colIndex}`, // Cell key
                  (cell, colIndex) => {
                        if (colIndex === 5) return html`<td voosh-sender="${cell}">\u00A0</td>`;
                        return rowIndex === 0 ? html`<th>${cell}</th>` : html`<td>${cell}</td>`;
                })}
              </tr>`
        ) : html``}
        </table>
        <div>&nbsp;</div>
        ${
            percent == 0
            ? html``
            : html`<wa-progress-bar id="progress-bar" .value=${percent}>
                ${percent >= 100.0 ? html`finalizado` : html`${percent}%`}
                </wa-progress-bar>`
        }`,
        () => html`not ready`)
    }
}
