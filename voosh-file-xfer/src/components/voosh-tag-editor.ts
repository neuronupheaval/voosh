import "@awesome.me/webawesome/dist/components/tag/tag.js";
import { customElement, property, state } from "lit/decorators.js";
import { BaseElement } from "../base/BaseElement";
import type WaTag from "@awesome.me/webawesome/dist/components/tag/tag.js";
import type { WaInput } from "@awesome.me/webawesome/dist/ssr/all.js";
import { repeat } from "lit/directives/repeat.js";
import { html } from "lit";

@customElement("voosh-tag-editor")
export class VooshTagEditor extends BaseElement {
    @property()
    tags: string[] = [];

    @state()
    content?: string = "";

    render() {
        return html`<wa-input id="editor" appearance="filled-outlined" placeholder="ex: fotos praia setembro 2026" @keyup=${this.keyUpEventHandler} ?disabled=${this.tags.length >= 7}></wa-input>
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
            tagElement.style.opacity = '0';
            tagElement.style.transition = 'opacity 0.4s ease';
            setTimeout(() => {
                this.resetTagContentTextBox();
                this.tags = this.tags.filter((_, index) => index !== removingIndex);
                this.triggerChangeEvent();
            }, 400);
        }
    }

    keyUpEventHandler(e: KeyboardEvent) {
        const textBox = e.target as WaInput;
        const keyPressed = e.key || e.code;

        if (keyPressed === "Enter" || keyPressed === "Space" || keyPressed === " ") {
            const content = textBox.value!.trim();
            if (content === "") {
                e.preventDefault();
                return;   
            }
            this.tags = [...this.tags, content];
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
