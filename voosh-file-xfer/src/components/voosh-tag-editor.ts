import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/tag/tag.js";
import { customElement, property, state } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import type WaInput from "@awesome.me/webawesome/dist/components/input/input.js";
import type WaTag from "@awesome.me/webawesome/dist/components/tag/tag.js";
import { repeat } from "lit/directives/repeat.js";
import { html } from "lit";

@customElement("voosh-tag-editor")
export class VooshTagEditor extends BaseElement {
    @property()
    tags: string[] = [];

    @state()
    content?: string = "";

    render() {
        return html`<wa-input id="editor" label="Explique o arquivo" appearance="filled-outlined" size="m" pill
            placeholder="ex: fotos praia setembro 2026" @input=${this.inputEventHandler} ?disabled=${this.tags.length >= 7}></wa-input>
        <p id="bag">${
        repeat(
            this.tags,
            (tag) => tag,
            (tag, _) => html`<wa-tag variant="neutral" appearance="filled" with-remove @wa-remove=${this.onTagRemoveEventHandler}>${tag}</wa-tag>`
        )}
        </p>`;
    }


    resetTagContentTextBox(): WaInput {
        const element = this.shadowRoot!.getElementById("editor")! as WaInput;
        element.value = "";
        return element;
    }
    
    onTagRemoveEventHandler(e: any) {
        const tagElement = e.target as WaTag;
        const removingIndex = this.tags.indexOf(tagElement.textContent.trim());
        if (removingIndex >= 0) {
            tagElement.style.transition = 'opacity 0.4s ease';
            tagElement.style.opacity = '0';
            setTimeout(() => {
                this.resetTagContentTextBox();
                this.tags = this.tags.filter((_, index) => index !== removingIndex);
                this.triggerChangeEvent();
            }, 400);
        }
    }

    inputEventHandler(e: any) {
        const textBox = e.target as WaInput;
        const value = textBox.value;
        const valueTrimmed = value?.trim() ?? "";

        if (valueTrimmed !== "" && value?.endsWith(" ")) {
            this.tags = [...this.tags, valueTrimmed];
            this.resetTagContentTextBox()
            this.triggerChangeEvent();
        }
    }

    triggerChangeEvent() {
        const event = new CustomEvent('voosh-change', {
            detail: { newValue: this.tags },
            bubbles: true
        });
        this.dispatchEvent(event);
    }
}
