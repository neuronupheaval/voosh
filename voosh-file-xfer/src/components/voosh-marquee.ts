import { LitElement, html, css, PropertyValues, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('voosh-marquee')
export class CustomMarquee extends LitElement {
    @property()
    text: string = "";

    @property()
    maxlength: number = 20;

    @state()
    whatIsShown: string = "";

    backup?: string;
    queue: string[] = [];
    timer?: ReturnType<typeof setInterval>;

    static override styles?: CSSResultGroup | undefined = css`
        .marquee-container {
            display: inline-block;
            font-size: 1.125rem;
            max-width: 40ch;
        }
        label:has(+ span.text-content) {
            font-size: 1rem;
            font-weight: bold;
        }
        span.text-content {
            font-style: italic;
            font-size: 1.125rem;
        }
    `;

    protected willUpdate(_changedProperties: PropertyValues): void {
        if (_changedProperties.has("text")) {
            if (this.text.length <= this.maxlength) {
                this.whatIsShown = this.backup = this.text;
                this.queue = [];
                clearInterval(this.timer);
            } else {
                if (this.backup !== this.text) {
                    this.backup = this.text;
                    this.queue = [ "\u00A0", "\u00A0", "\u00A0", "\u00A0", ...this.backup ];
                }
                this.timer = setInterval(() => {
                    this.whatIsShown = this.queue.join("").substring(0, this.maxlength);
                    const head = this.queue.shift()!;
                    this.queue.push(head);
                }, 220);
            }
        }
    }

    render() {
        return html`
          <div class="marquee-container">
              ${ this.whatIsShown ? html`<label>Escolhido:\u00A0</label>` : html``}<span class="text-content">${this.whatIsShown}</span>
          </div>
        `;
    }
}
