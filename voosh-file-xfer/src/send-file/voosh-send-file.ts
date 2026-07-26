import "../components/voosh-file-summarizer";
import "../components/voosh-tag-editor";
import "../components/voosh-uploader";
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/carousel/carousel.js';
import '@awesome.me/webawesome/dist/components/carousel-item/carousel-item.js'
import { css, html, type CSSResultGroup, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { Utility } from "../base/Utility";
import { BaseElement } from "../base/BaseElement";
import type WaCarousel from "@awesome.me/webawesome/dist/components/carousel/carousel.js";
import { classMap } from "lit/directives/class-map.js";
import { when } from "lit/directives/when.js";

@customElement("voosh-send-file")
export class VooshSendFile extends BaseElement {
    @property()
    readonly isUpload: boolean = true;

    @property({ attribute: false, type: Object })
    file?: File;
    
    @property()
    tags: string[] = [];

    @property()
    confirm: boolean = false;

    @state()
    errorMessage?: string;

    @state()
    ref?: string;
    
    static override styles?: CSSResultGroup | undefined = css`
    .modern-file-input {
            font-family: sans-serif;
            color: #555;
        }

        .file-input-error {
            color: #a00;
        }

        .modern-file-input::file-selector-button {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.3s ease;
        }

        .file-input-error::file-selector-button {
            background-color: #a00;
            transition: background-color 0.5s ease;
        }

        .modern-file-input::file-selector-button:hover {
            background-color: #2980b9;
        }
            
        .button-container {
            margin: 12px;
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
            align-items: center;
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
            detail: { value: this.isUpload },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);    
    }

    render() {
        const fileClassMap = {
            "modern-file-input": true,
            "file-input-error": !!this.errorMessage
        }
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
                <div class="slide-contnent">
                    <h2>Escolha arquivo a upar</h2>
                    <input type="file" id="send" class="${classMap(fileClassMap)}" @change=${this.onFileChangeEventHandler}
                        accept="audio/*,image/*,video/*,application/pdf,application/zip"></input>
                    <p>${this.errorMessage}</p>
                </div>
            </wa-carousel-item>
            <wa-carousel-item>
                <div class="slide-content">
                    <h2>Confirmação</h2>
                    <voosh-file-summarizer .tags=${this.tags} .file=${this.file}></voosh-file-summarizer>
                    <div class="button-container">
                        <wa-button id="nok" variant="neutral" @click=${this.onClickCancelEventHandler}>Cancelar</wa-button>
                        <wa-button id="ok" variant="success" @click=${this.onClickOkEventHandler}>OK</wa-button>
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
        console.log("===blargh===");
        const target = e.target;
        const files = target.files;
        if (files.length === 1 && files[0] && files[0]!.size < 100 * 1024 * 1024) {
            console.log(`files.length = ${files.length}, file name = ${files[0].name}, file size = ${files[0].size}`);
            this.errorMessage = "";
            this.file = files[0];
            this.ref = await Utility.getRef(this.file!);            
        } else if (!files[0]) {
            console.log("error while opening file.");
            this.errorMessage = "Erro durante abertura do arquivo!";
            setTimeout(() => { target.value = '' }, 800);
        } else {
            console.log(`files.length = ${files.length}, file size = ${files[0]?.size}`);
            this.errorMessage = "Arquivo tem que ter menos de 100 megas";
            setTimeout(() => { target.value = ''; this.file = undefined; }, 800);
        }
    }

    onTagsChangeEventHandler(e: any) {
        this.tags = e.detail.newValue;
    }
  }
