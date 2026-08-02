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

    @state()
    private hasAnyUserActivity: Boolean | null = null;
    private noActivityTimer?: ReturnType<typeof setInterval>;

    @query('#explanation') private readonly explanation!: HTMLParagraphElement | null;
    
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

        #explanation {
            padding: 20px;
            border: 6px dashed #ccc;
            border-radius: 20px;
            opacity: 0;
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

    protected updated(_changedProperties: PropertyValues): void {
        console.log("passei 3");
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

    disconnectedCallback(): void {
        clearInterval(this.noActivityTimer);
        super.disconnectedCallback();
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

        this.clearExplanation();
    }

    onExpand() {
        console.log("voosh-send-file got onExpand")
        const event = new CustomEvent('voosh-is-upload', {
            detail: { value: true /**This is an upload*/},
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
        
        if (!this.noActivityTimer) {
            this.onFirstCarouselItemLoad();
        }
    }

    render() {
        return html`
        <wa-carousel id="slider" @wa-slide-change=${this.slideChangeEventHandler}>
            ${
                when(this.confirm, () => 
            html`<wa-carousel-item>
                <div id="first-landing-slide" class="slide-content">
                    <h2>Informe as tags</h2>
                    <voosh-tag-editor .tags=${this.tags} @voosh-change=${this.onTagsChangeEventHandler}></voosh-tag-editor>
                    <p id="explanation">&nbsp;</p>
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

    onFirstCarouselItemLoad() {
        console.log("passei 4");
        this.noActivityTimer = setInterval(() => {
            if (this.confirm) {
                if (this.hasAnyUserActivity !== false) {
                    this.hasAnyUserActivity = false;
                } else if (this.hasAnyUserActivity === false) {
                    const hasTouchScreen = window.matchMedia("(pointer: coarse)").matches;
                    const explanationElement = (this.shadowRoot || this).querySelector('#explanation')! as HTMLParagraphElement;
                    explanationElement.innerText = "Explique o assunto do arquivo, acima, como o exemplo. Depois,";
                    explanationElement.innerText += hasTouchScreen
                        ? "\u00a0arraste o dedo na tela para prosseguir."
                        : "\u00a0use a tecla \u2192 do teclado para prosseguir.";
                    explanationElement.style.transition = 'opacity 1.1s ease';
                    explanationElement.style.opacity = '0.7';
                }
            }
        }, 5_000);
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

    clearExplanation() {
        clearInterval(this.noActivityTimer);
        const explanationElement = this.explanation!;
        explanationElement.style.transition = 'opacity 0.4s ease';
        explanationElement.style.opacity = '0';
        setTimeout(() => explanationElement.textContent = '', 400);
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
            this.errorMessage = "O arquivo tem que ter menos de 100 megas";
            setTimeout(() => { this.errorMessage = ''; this.file = undefined; }, 800);
        }
    }

    onTagsChangeEventHandler(e: any) {
        this.tags = e.detail.newValue;
    }
  }
