/// <reference path="ImageWritr.d.ts" />

module ImageWritr {
    "use strict";

    export class ImageWritr implements IImageWritr {
        /**
         * 
         */
        private PixelRender: PixelRendr.IPixelRendr;

        /**
         * 
         */
        private palettes: { [i: string]: number[][]; };

        /**
         * 
         */
        private palette: string;

        /**
         * 
         */
        private paletteDefault: string;

        /**
         * 
         */
        private allowedFiles: { [i: string]: boolean; };

        /**
         * 
         */
        private sectionSelector: string;

        /**
         * 
         */
        private inputSelector: string;

        /**
         * 
         */
        private outputSelector: string;

        private spriteDrawers: any[];

        /**
         * 
         */
        constructor(settings: IImageWritrSettings) {
            this.spriteDrawers = [];
            this.allowedFiles = settings.allowedFiles;
            this.sectionSelector = settings.sectionSelector;
            this.inputSelector = settings.inputSelector;
            this.outputSelector = settings.outputSelector;
            this.paletteDefault = settings.paletteDefault;
            this.palettes = settings.palettes;

            this.palette = settings.paletteDefault;

            this.initializePalettes();

            this.initializeInput(this.inputSelector);
        }


        /* Internal resets
        */

        /**
         * 
         */
        private initializePalettes(): void {
            var section: HTMLElement = <HTMLElement>document.querySelector(this.sectionSelector),
                name: string,
                element: HTMLElement,
                chosen: HTMLElement;

            section.appendChild(this.initializePaletteUploader());

            for (name in this.palettes) {
                if (!this.palettes.hasOwnProperty(name)) {
                    continue;
                }

                element = this.initializePalette(name, this.palettes[name]);
                section.appendChild(element);

                if (name === this.paletteDefault) {
                    chosen = element;
                }
            }

            chosen.click();
        }

        /**
         * 
         */
        private initializePalette(name: string, palette: number[][]| Uint8ClampedArray[]): HTMLDivElement {
            var surround: HTMLDivElement = document.createElement("div"),
                label: HTMLHeadingElement = document.createElement("h4"),
                container: HTMLDivElement = document.createElement("div"),
                color: number[],
                boxOut: HTMLDivElement,
                boxIn: HTMLDivElement,
                i: number;

            surround.className = "palette";
            label.className = "palette-label";
            container.className = "palette-container";

            surround.onclick = this.choosePalette.bind(this, surround, name, palette);

            label.textContent = "Palette: " + name;

            for (i = 0; i < palette.length; i += 1) {
                color = <number[]>palette[i];

                boxOut = document.createElement("div");
                boxOut.className = "palette-box";

                boxIn = document.createElement("div");
                boxIn.className = "palette-box-in";
                boxIn.style.background = "rgba(" + color.join(",") + ")";

                boxOut.appendChild(boxIn);
                container.appendChild(boxOut);
            }

            surround.appendChild(label);
            surround.appendChild(container);

            return surround;
        }

        /**
         * 
         */
        private initializePaletteUploader(): HTMLElement {
            var surround: HTMLDivElement = document.createElement("div"),
                label: HTMLHeadingElement = document.createElement("h4");

            surround.className = "palette palette-uploader";
            label.className = "palette-label";

            label.textContent = "Drag or upload an image here to generate a palette.";

            this.initializeClickInput(surround);
            this.initializeDragInput(surround);

            (<IWorkerHTMLElement>surround.children[0]).workerCallback = this.workerPaletteUploaderStart.bind(this);

            surround.appendChild(label);

            return surround;
        }

        /**
         * 
         */
        private choosePalette(element: HTMLElement, name: string, palette: number[][], event: Event): void {
            var elements: HTMLCollection = element.parentElement.children,
                i: number;

            for (i = 0; i < elements.length; i += 1) {
                (<HTMLElement>elements[i]).className = "palette";
            }

            element.className = "palette palette-selected";

            this.PixelRender = new PixelRendr.PixelRendr({
                "paletteDefault": palette
            });

            this.palette = name;
        }


        /* Input
        */

        /**
         * 
         */
        private initializeInput(selector: string): void {
            var input: HTMLElement = <HTMLElement>document.querySelector(selector);

            this.initializeClickInput(input);
            this.initializeDragInput(input);
        }

        /**
         * 
         */
        private initializeClickInput(input: HTMLElement): void {
            var dummy: HTMLInputElement = document.createElement("input");

            dummy.type = "file";
            dummy.multiple = true;
            dummy.onchange = this.handleFileDrop.bind(this, dummy);

            input.addEventListener("click", function (): void {
                dummy.click();
            });

            input.appendChild(dummy);
        }

        /**
         * 
         */
        private initializeDragInput(input: HTMLElement): void {
            input.ondragenter = this.handleFileDragEnter.bind(this, input);
            input.ondragover = this.handleFileDragOver.bind(this, input);
            input.ondragleave = input.ondragend = this.handleFileDragLeave.bind(this, input);
            input.ondrop = this.handleFileDrop.bind(this, input);
        }

        /**
         * 
         */
        private handleFileDragEnter(input: HTMLElement, event: DragEvent): void {
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = "copy";
            }
            input.className += " hovering";
        }

        /**
         * 
         */
        private handleFileDragOver(input: HTMLInputElement, event: DragEvent): boolean {
            event.preventDefault();
            return false;
        }

        /**
         * 
         */
        private handleFileDragLeave(input: HTMLInputElement, event: DragEvent): void {
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = "none";
            }
            input.className = input.className.replace(" hovering", "");
        }

        /**
         * 
         * 
         * @remarks input.files is when the input[type=file] is the source, while
         *          event.dataTransfer.files is for drag-and-drop.
         */
        private handleFileDrop(input: HTMLInputElement, event: DragEvent): void {
            var files: FileList = input.files || event.dataTransfer.files,
                output: HTMLElement = <HTMLElement>document.querySelector(this.outputSelector),
                elements: IWorkerHTMLElement[] = [],
                file: File,
                tag: string,
                element: HTMLDivElement,
                i: number;

            this.handleFileDragLeave(input, event);

            event.preventDefault();
            event.stopPropagation();

            for (i = 0; i < files.length; i += 1) {
                file = files[i];
                tag = file.type.split("/")[1];

                if (!this.allowedFiles[tag]) {
                    element = document.createElement("div");
                    element.className = "output output-failed";
                    element.textContent = "'" + file.name + "' is either a folder or has a non-image type...";
                    elements.push(element);
                    continue;
                }

                elements.push(this.createWorkerElement(files[i], <IWorkerHTMLElement>event.target));
            }

            for (i = 0; i < elements.length; i += 1) {
                output.insertBefore(elements[i], output.firstElementChild);
            }
        }

        /**
         * 
         */
        private createWorkerElement(file: File, target: IWorkerHTMLElement): IWorkerHTMLElement {
            var element: IWorkerHTMLElement = <IWorkerHTMLElement>document.createElement("div"),
                reader: FileReader = new FileReader();

            element.workerCallback = target.workerCallback;
            element.className = "output output-uploading";
            element.setAttribute("palette", this.palette);
            element.innerText = "Uploading '" + file.name + "'...";

            reader.onprogress = this.workerUpdateProgress.bind(this, file, element);
            reader.onloadend = this.workerTryStartWorking.bind(this, file, element);
            reader.readAsDataURL(file);

            return element;
        }

        /**
         * 
         */
        private workerUpdateProgress(file: File, element: HTMLElement, event: ProgressEvent): void {
            if (!event.lengthComputable) {
                return;
            }

            var percent: number = Math.min(Math.round((event.loaded / event.total) * 100), 100);

            element.innerText = "Uploading '" + file.name + "' (" + percent + "%)...";
        }

        /**
         * 
         * 
         * 
         */
        private workerTryStartWorking(file: File, element: IWorkerHTMLElement, event: ProgressEvent): void {
            var result: string = (<any>event.currentTarget).result;

            if (element.workerCallback) {
                element.workerCallback(result, file, element, event);
            } else {
                this.workerTryStartWorkingDefault(result, file, element, event);
            }
        }

        /**
         * 
         */
        private workerTryStartWorkingDefault(result: string, file: File, element: HTMLElement, event: Event): void {
            var that: any = this;
            var reader: FileReader = new FileReader();
            reader.onloadend = function(): void {
                var settings: PixelRendr.IPixelRendrSettings = new Function(
                    this.result.replace(/^[^=]*=/, "return") )();
                // Leave default values to make sure we can draw the sprite.
                settings.spriteWidth = settings.spriteHeight = "";
                that.PixelRender = new PixelRendr.PixelRendr( settings );
                that.traverseSpriteLibrary(that.PixelRender.getBaseLibrary());
                console.log(settings);
            };
            reader.readAsText(file);
            /*
            if (result.length > 100000) {
                this.workerCannotStartWorking(result, file, element, event);
            } else {
                this.workerStartWorking(result, file, element, event);
            }
            */
        }

        private processSprite(key: string, value: number): void {
            console.log(key + ": " + value);
            var e: any = createDomElements();
            this.spriteDrawers.push( new SpriteDrawr(
                this.PixelRender, key, value,
                e.left, e.right, e.width, e.height, e.canvas, e.link) );
            var output: HTMLElement = <HTMLElement>document.querySelector(
                this.outputSelector);
            output.insertBefore(e.container, output.firstElementChild);
        }

        private traverseSpriteLibrary(o: Object, prevKey: string = ""): void {
            var i: any;
            for (i in o) {
                if (o[i] !== null && typeof(o[i]) === "object") {
                    if ( o[i].constructor === Uint8ClampedArray ) {
                        this.processSprite(
                            (i !== "normal" ? prevKey + i : prevKey),
                            o[i].length / 4 );
                    } else {
                        this.traverseSpriteLibrary( o[i], prevKey + i + " " );
                    }
                }
            }
        }

        /* *
         * 
        private workerCannotStartWorking(result: string, file: File, element: HTMLElement, event: Event): void {
            element.innerText = "'" + file.name + "' is too big! Use a smaller file.";
            element.className = "output output-failed";
        }
         */

        /* *
         * 
        private workerStartWorking(result: string, file: File, element: HTMLElement, event: Event): void {
            var displayBase64: HTMLInputElement = document.createElement("input");

            element.className = "output output-working";
            element.innerText = "Working on " + file.name + "...";

            displayBase64.spellcheck = false;
            displayBase64.className = "selectable";
            displayBase64.type = "text";
            displayBase64.setAttribute("value", result);

            element.appendChild(document.createElement("br"));
            element.appendChild(displayBase64);

            this.parseBase64Image(file, result, this.workerFinishRender.bind(this, file, element));
        }
         */

        /* *
         * 
        private parseBase64Image(file: File, src: string, callback: PixelRendr.IPixelRendrEncodeCallback): void {
            var image: HTMLImageElement = document.createElement("img");
            image.onload = this.PixelRender.encode.bind(this.PixelRender, image, callback);
            image.src = src;
        }
         */

        /* *
         * 
        private workerFinishRender(file: File, element: HTMLElement, result: string, image: HTMLImageElement): void {
            var displayResult: HTMLInputElement = document.createElement("input");

            displayResult.spellcheck = false;
            displayResult.className = "selectable";
            displayResult.type = "text";
            displayResult.setAttribute("value", result);

            element.firstChild.textContent = "Finished '" + file.name + "' ('" + element.getAttribute("palette") + "' palette).";
            element.className = "output output-complete";
            element.style.backgroundImage = "url('" + image.src + "')";

            element.appendChild(displayResult);
        }
         */

        /**
         * 
         */
        private workerPaletteUploaderStart(result: string, file: File, element: HTMLElement, event: Event): void {
            var image: HTMLImageElement = document.createElement("img");
            image.onload = this.workerPaletteCollect.bind(this, image, file, element, result);
            image.src = result;

            element.className = "output output-working";
            element.innerText = "Working on " + file.name + "...";
        }

        /**
         * 
         */
        private workerPaletteCollect(image: HTMLImageElement, file: File, element: HTMLElement, src: string, event: Event): void {
            var canvas: HTMLCanvasElement = document.createElement("canvas"),
                context: CanvasRenderingContext2D = <CanvasRenderingContext2D>canvas.getContext("2d"),
                data: Uint8ClampedArray;

            canvas.width = image.width;
            canvas.height = image.height;

            context.drawImage(image, 0, 0);

            data = <Uint8ClampedArray><any>context.getImageData(0, 0, canvas.width, canvas.height).data;

            this.workerPaletteFinish(
                this.PixelRender.generatePaletteFromRawData(<Uint8ClampedArray>data, true, true),
                file,
                element,
                src);
        }

        /**
         * 
         */
        private workerPaletteFinish(colors: Uint8ClampedArray[], file: File, element: HTMLElement, src: string): void {
            var chooser: HTMLDivElement = this.initializePalette(file.name, colors),
                displayResult: HTMLInputElement = document.createElement("input");

            chooser.style.backgroundImage = "url('" + src + "')";

            displayResult.spellcheck = false;
            displayResult.className = "selectable";
            displayResult.type = "text";
            displayResult.setAttribute("value", "[ [" + colors.join("], [") + "] ]");

            if (colors.length > 999) {
                element.className = "output output-failed";
                element.innerText = "Too many colors (>999) in " + file.name + " palette.";
            }

            element.className = "output output-complete";
            element.innerText = "Created " + file.name + " palette (" + colors.length + " colors).";

            document.querySelector("#palettes").appendChild(chooser);

            element.appendChild(displayResult);

            chooser.click();
        }
    }

/*
    export function processInput(
        inputString: string,
        output: HTMLElement,
        spriteDrawers: any[])
    : void {
        var pr: PixelRendr.IPixelRendr = createPixelRender( inputString );
        var e: ISpriteDrawrDomElements = createDomElements();
        spriteDrawers.push( new SpriteDrawr(
            pr, e.left, e.right, e.width, e.height, e.canvas, e.link) );
        output.insertBefore( e.container, output.firstElementChild );
    }
*/

    function createDomElements(): any {
        var e: any = {
            container : document.createElement( "div" ),
            left   : createInputHelper( "button", "←" ),
            right  : createInputHelper( "button", "→" ),
            width  : createInputHelper( "text" ),
            height : createInputHelper( "text" ),
            link   : document.createElement( "a" ),
            canvas : document.createElement( "canvas" )
        };
        e.container.appendChild( e.left );
        e.container.appendChild( e.right );
        e.container.appendChild( document.createElement("br") );
        e.container.appendChild( e.width );
        e.container.appendChild( e.height );
        e.container.appendChild( document.createElement("br") );
        e.container.appendChild( e.link );
        e.link.appendChild( e.canvas );
        e.container.className = "output";
        return e;
    }

    function createInputHelper(type: string, value?: string)
    : HTMLInputElement {
        var input: HTMLInputElement = document.createElement("input");
        if ( type === "text" ) {
            input.type = "text";
            input.readOnly = true;
        } else if ( type === "button" ) {
            input.type = "button";
            input.value = value;
        }
        return input;
    }

    class SpriteDrawr {
        private pixelRender: PixelRendr.IPixelRendr;
        private spriteKey: string;
        private dims: number[][];
        private dimIndex: number;
        private canvas: HTMLCanvasElement;
        private widthText: HTMLInputElement;
        private heightText: HTMLInputElement;
        private link: HTMLAnchorElement;
        private leftButton: HTMLInputElement;
        private rightButton: HTMLInputElement;

        constructor(
            pixelRender: PixelRendr.IPixelRendr,
            spriteKey: string,
            nPixels: number,
            leftButton: HTMLInputElement,
            rightButton: HTMLInputElement,
            widthText: HTMLInputElement,
            heightText: HTMLInputElement,
            canvas: HTMLCanvasElement,
            link: HTMLAnchorElement
        ) {
            this.pixelRender = pixelRender;
            this.spriteKey = spriteKey;
            this.dims = calculatePossibleDimensions(nPixels);
            this.dimIndex = Math.floor( (this.dims.length - 1) / 2 );
            this.canvas = canvas;
            this.widthText  = widthText;
            this.heightText = heightText;
            this.link = link;
            this.leftButton  = leftButton;
            this.rightButton = rightButton;
            var that: any = this;
            this.leftButton.onclick  = function(): void {
                that.updateDim("-");
            };
            this.rightButton.onclick = function(): void {
                that.updateDim("+");
            };
            this.updateDim();
        }

        private updateDim(op?: string): void {
            var maxInd: number = this.dims.length - 1;
            if ( op === "+" ) {
                if ( this.dimIndex >= maxInd ) {
                    this.dimIndex = maxInd;
                } else {
                    ++this.dimIndex;
                }
            } else if ( op === "-" ) {
                if ( this.dimIndex <= 0 ) {
                    this.dimIndex = 0;
                } else {
                    --this.dimIndex;
                }
            }

            this.canvas.width  = this.dims[this.dimIndex][0];
            this.canvas.height = this.dims[this.dimIndex][1];
            this.widthText.value  = String( this.canvas.width );
            this.heightText.value = String( this.canvas.height );

            this.rightButton.disabled = (this.dimIndex === maxInd);
            this.leftButton .disabled = (this.dimIndex === 0);

            this.render();
        }

        private render(): void {
            var sizing: any = {
                spriteWidth: this.canvas.width,
                spriteHeight: this.canvas.height
            };
            var sprite: any = this.pixelRender.decode(this.spriteKey, sizing);
            var context: any = this.canvas.getContext("2d");

            var imageData: any = context.getImageData(
                0, 0, this.canvas.width, this.canvas.height);
            this.pixelRender.memcpyU8(sprite, imageData.data);
            context.putImageData(imageData, 0, 0);

            // Work around error TS2339.
            (<any>this.link).download = "mario.png";
            this.link.href = this.canvas.toDataURL("image/png");
        }
    }

    function calculatePossibleDimensions(nPixels: number): number[][] {
        if ( nPixels === 0 ) { return null; }

        var dims: number[][] = [ [1, nPixels] ];
        var upTo: number = Math.sqrt(nPixels);
        for ( var n: number = 2; n <= upTo; ++n ) {
            if ( nPixels % n === 0 ) {
                dims.push( [n, nPixels / n] );
            }
        }

        var iReverseUpTo: number = dims.length - 1;
        if ( dims[iReverseUpTo][0] === dims[iReverseUpTo][1] ) {
            --iReverseUpTo;
        }
        for ( var i: number = iReverseUpTo ; i >= 0 ; --i ) {
            dims.push( [ dims[i][1], dims[i][0] ] );
        }

        return dims;
    }
}

