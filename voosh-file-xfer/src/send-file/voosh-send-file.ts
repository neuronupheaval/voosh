import "../components/voosh-file-summarizer";
import "../components/voosh-tag-editor";
import "../components/voosh-uploader";
import "../components/voosh-file-input";
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/carousel/carousel.js';
import '@awesome.me/webawesome/dist/components/carousel-item/carousel-item.js'
import { css, html, type CSSResultGroup, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { Utility } from "../base/Utility";
import { BaseElement } from "../base/BaseElement";
import type WaCarousel from "@awesome.me/webawesome/dist/components/carousel/carousel.js";
import { when } from "lit/directives/when.js";

@customElement("voosh-send-file")
export class VooshSendFile extends BaseElement {
    @property({ attribute: false, type: Object })
    file?: File;
    
    @property({ type: Array })
    tags: string[] = [];

    @property({ type: Boolean })
    confirm: boolean = true;

    @state()
    errorMessage?: string;

    @state()
    ref?: string;
    
    static override styles?: CSSResultGroup | undefined = css`
        wa-carousel-item {
            align-items: normal;
        }

        .ok-button {
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

        .ok-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .ok-button:active {
            transform: translateY(0);
        }

        @media(max-width: 767px) {
            wa-carousel {
                width: 100dvw;
                height: 100dvh;
            }
            wa-carousel-item {
                width: 100%;
                height: 100%;
            }
            .slide-content {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: normal;
                padding: 20px;
                box-sizing: border-box;
            }
        }`;

    @query('wa-carousel') carousel!: WaCarousel;

    protected willUpdate(_changedProperties: PropertyValues): void {
        if (_changedProperties.has("file")) {
            console.log(`  old file name = ${_changedProperties.get("file")?.name}, new = ${this.file?.name}`)
        }
    }

    private slideChangeEventHandler(event: CustomEvent) {
        // 1. Get the index of the newly active slide from Web Awesome's event detail
        const activeIndex = event.detail.index;
        console.log(`voosh-send-file activeIndex = ${activeIndex}`);

        // 2. Find all carousel items inside the component
        const slides = this.carousel.querySelectorAll('wa-carousel-item');
        const currentSlide = slides[activeIndex];

        if (currentSlide) {
            let queue = [ ...currentSlide.children ];
            while (queue.length > 0) {
                const queueHead = queue.shift()!;
                if (queueHead && "onSlideChanged" in queueHead) {
                    (queueHead as any).onSlideChanged({ target: event.target, currentSlide: currentSlide, index: event.detail.index });
                }
                queue = [...queue, ...queueHead.children];
            }
        }
    }

    onExpand() {
        console.log("voosh-send-file got onExpand")
        const event = new CustomEvent('voosh-is-upload', {
            detail: { value: true /**This is an upload*/},
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);    
    }

    render() {
        return html`
        <wa-carousel navigation id="slider" @wa-slide-change=${this.slideChangeEventHandler}>
            ${
                when(this.confirm, () => 
            html`<wa-carousel-item>
                <div class="slide-content">
                    <h2>Informe as tags</h2>
                    <voosh-tag-editor .tags=${this.tags} @voosh-change=${this.onTagsChangeEventHandler}></voosh-tag-editor>
                </div>
            </wa-carousel-item>
            <wa-carousel-item>
                <div class="slide-content">
                    <h2>Escolha arquivo a upar</h2>
                    <voosh-file-input id="send" @voosh-change=${this.onFileChangeEventHandler}
                        accept="audio/*,image/*,video/*,application/pdf,application/zip"></input>
                    <p>${this.errorMessage}</p>
                </div>
            </wa-carousel-item>
            <wa-carousel-item>
                <div class="slide-content">
                    <h2>Confirmação</h2>
                    <voosh-file-summarizer .tags=${this.tags} .file=${this.file}></voosh-file-summarizer>
                    <div class="button-container">
                        <a href="#" @click=${this.onClickCancelEventHandler}>Cancelar</a>
                        <span>\u00A0</span>
                        <button id="ok" class="ok-button" @click=${this.onClickOkEventHandler}>OK</button>
                    </div>
                </div>
            </wa-carousel-item>
            <wa-carousel-item>
                <div class="slide-content">
                    <voosh-uploader .ref=${this.ref} .tags=${this.tags} .file=${this.file}></voosh-uploader>
                </div>
            </wa-carousel-item>`,
                () => html`<wa-carousel-item>not ready</wa-carousel-item>`)
            }
        </wa-carousel>`;
    }

    onClickOkEventHandler() {
        const sliderElement = this.shadowRoot!.getElementById("slider")! as WaCarousel;
        sliderElement.next();
    }

    onClickCancelEventHandler() {
        const sliderElement = this.shadowRoot!.getElementById("slider")! as WaCarousel;
        sliderElement.previous();
    }
    
    async onFileChangeEventHandler(e: any) {
        //console.log("===blargh===");
        const files = e.detail;
        if (files.length === 1 && files[0] && files[0].size < 100 * 1024 * 1024) {
            console.log(`files.length = ${files.length}, file name = ${files[0].name}, file size = ${files[0].size}`);
            this.errorMessage = "";
            this.file = files[0];
            this.ref = await Utility.getRef(this.file!);            
        } else if (!files[0]) {
            console.log("error while opening file.");
            this.errorMessage = "Erro durante abertura do arquivo!";
            setTimeout(() => { this.errorMessage = '' }, 800);
        } else {
            console.log(`files.length = ${files.length}, file size = ${files[0]?.size}`);
            this.errorMessage = "Arquivo tem que ter menos de 100 megas";
            setTimeout(() => { this.errorMessage = ''; this.file = undefined; }, 800);
        }
    }

    onTagsChangeEventHandler(e: any) {
        this.tags = e.detail.newValue;
    }
  }
