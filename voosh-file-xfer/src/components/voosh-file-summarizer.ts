import '@awesome.me/webawesome/dist/components/copy-button/copy-button.js';
import '@awesome.me/webawesome/dist/components/tag/tag.js';
import { customElement, property } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import { css, html, type CSSResultGroup } from "lit";
import { Utility } from "../base/Utility";
import { until } from "lit/directives/until.js";
import { when } from 'lit/directives/when.js';

@customElement("voosh-file-summarizer")
export class VooshFileSummarizer extends BaseElement {
    @property()
    file?: File;
    
    @property()
    tags: string[] = [];

    static override styles?: CSSResultGroup | undefined = css`
        @media (max-width: 600px) {
            tr {
                display: flex;
                flex-wrap: wrap;
                border-bottom: 1px solid var(--wa-color-neutral-300, #ccc);
            }
            tr td:nth-child(1) {
                display: inline-block;
                font-weight: bold;
                text-align: left;
                min-width: 15ch;
            }
            tr td:nth-child(2) {
                flex-grow: 1;
                text-align: right;
                padding: 1.0em 0;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                border: 0;
            }
        }

        @media(min-width: 601px) {
            .ref {
                font-size: 1.75em;
                font-family: "Lucida Console", "Courier New", monospace;
            }
            .right {
                text-align: right;
            }
            table, th, td {
                border: 1px solid var(--wa-color-neutral-300, #ccc);
                border-collapse: collapse;
                padding: 8px;
            }
            table {
                width: 100%;
                min-width: 25wh;
            }
            tr td:nth-child(even) {
                text-align: right;
            }
            tr.highlight {
                background-color: #ccc;
            }
        }

        p#tagBag {
        }
`;

    render() {
        return html`
        <div class="table-container">
            <table class="wa-zebra-rows wa-hover-rows wa-tabular-nums" width="100%">
                <tbody>
                    <tr>
                        <td>Nome do arquivo</td>
                        <td><voosh-marquee text=${this.file?.name}></voosh-marquee></td>
                    </tr>
                    <tr>
                        <td>Tamanho</td>
                        <td>${this.humanSize(this.file?.size)}</td>
                    </tr>
                    <tr>
                        <td>Tags</td>
                        <td><p id="tagBag">${when(this.tags.length === 0, 
                            () => html`<span class="wa-color-neutral-500">n/a</span>`, 
                            () => html`${this.tags.map(tag => html`<wa-tag appearance="filled-outlined">${tag}</wa-tag>`)}`)
                        }</p></td>
                    </tr>
                    <tr class="highlight">
                        <td>Ref</td>
                        <td class="ref" id="ref">${ until(Utility.getRef(this.file), "Aguarde") }
                            <wa-copy-button value=${ until(Utility.getRef(this.file), "Aguarde...")}></wa-copy-button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    }

    humanSize(sizeInBytes?: number) {
        if (!sizeInBytes)
            return "Arquivo vazio!";
        if (sizeInBytes < 1024 * 1024)
            return "Menos de um mega";
        if (sizeInBytes < 10 * 1024 * 1024)
            return (sizeInBytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mega(s)";
        
        return (sizeInBytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " megas";
    }
}
