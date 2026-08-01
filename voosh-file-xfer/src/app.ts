import '@awesome.me/webawesome/dist/webawesome.js';      // registers <wa-*> elements
import '@awesome.me/webawesome/dist/styles/themes/default.css'; // base theme

import '@awesome.me/webawesome/dist/components/accordion/accordion.js';
import '@awesome.me/webawesome/dist/components/accordion/accordion.styles.js'
import '@awesome.me/webawesome/dist/components/accordion-item/accordion-item.js';
import './send-file/voosh-send-file';
import './receive-file/voosh-receive-file';
import { customElement, property, state } from 'lit/decorators.js';
import { html } from 'lit/html.js';
import { BaseElement } from './base/BaseElement';
import type { WaAccordionExpandEvent } from '@awesome.me/webawesome/dist/events/accordion-expand.js';
import type WaAccordionItem from '@awesome.me/webawesome/dist/components/accordion-item/accordion-item.js';

@customElement("voosh-app")
export class App extends BaseElement {
    @property()
    appName = "Voosh-Voosh";

    @property({ attribute: false})
    sendFile?: File;
    
    @property()
    receiveRef?: string;
    
    @state()
    isUpload: boolean = true;

    connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener('voosh-is-upload' as any, this.onVooshIsUpload);
    }

    disconnectedCallback(): void {
        this.removeEventListener('voosh-is-upload' as any, this.onVooshIsUpload);
        super.disconnectedCallback();
    }
    
    render() {
        console.log(`app.ts this.isUpload = ${this.isUpload}`);
        return html`
        <wa-accordion mode="single-collapsible" @wa-expand=${this.onExpandEventHandler}>
            <wa-accordion-item label="Enviar arquivo &gt;">
                <voosh-send-file id="send" ?confirm=${this.isUpload}></voosh-send-file>
            </wa-accordion-item>
            <wa-accordion-item label="&lt; Receber arquivo">
                <voosh-receive-file id="receive" ?confirm=${!this.isUpload}></voosh-receive-file>
            </wa-accordion-item>
        </wa-accordion>`;
    }
    
    // Bubbles down the onExpand event.
    onExpandEventHandler(e: WaAccordionExpandEvent) {
        const accordion = e.target as HTMLElement;
        const accordionItemExpanded = e.detail.item as WaAccordionItem;
        const children = accordionItemExpanded.children;
        const elements = [...children];
        while (elements.length > 0) {
            const element = elements.shift();
            if ("onExpand" in element!) {
                (element as any).onExpand({ target: accordion });
                for (let i = 0; i < element.children.length; ++i) {
                    elements.push(element.children[i]);
                }
            }
        }
    }

    private onVooshIsUpload(e: CustomEvent) {
        console.log("voosh-app got onVooshIsUpload, e.detail.value = " + e.detail.value);
        this.isUpload = e.detail.value;
    }
}
