import "../components/voosh-marquee";
import { customElement, property, state } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import { css, CSSResultGroup, html } from "lit";

@customElement("voosh-file-input")
export class VooshFileInput extends BaseElement {
    @property()
    accept?: string;

    @state()
    fileName?: string;

    static override styles?: CSSResultGroup | undefined = css`
    /* Visually hide the ugly input completely */
    .file-input-container {
        min-width: 25wh;
    }
    
    .hidden-input {
        display: none;
    }

    /* Embellish the label like a beautiful button */
    .custom-file-upload {
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

    /* Interactive States */
    .custom-file-upload:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .custom-file-upload:active {
        transform: translateY(0);
    }
    `;

    onChange(event: InputEvent) {
        const file = (event.target as HTMLInputElement).files![0];
        this.fileName = file.name;
        this.bubbleChange();
    }

    bubbleChange() {
        const input = 
            this.shadowRoot!.getElementById("file-upload")! as HTMLInputElement;
        this.dispatchEvent(new CustomEvent('voosh-change', {
            detail: input.files,
            bubbles: true,
            composed: true // Allows event to cross the Shadow DOM boundary
        }));
    }

    render() {
        return html`
            <div class="file-input-container">
                <div>
                    <input type="file" id="file-upload" class="hidden-input" .accept=${this.accept} @change=${this.onChange} />
                    <label for="file-upload" class="custom-file-upload">
                        📁 Clique aqui pra escolher
                    </label>
                <div>
                <div>&nbsp;</div>
                <div>
                    <voosh-marquee text=${this.fileName}></voosh-marquee>
                </div>
            </div>
        `;
    }
}
