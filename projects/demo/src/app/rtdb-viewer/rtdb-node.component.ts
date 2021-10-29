import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { AbstractControl, FormArray, FormControl } from "@angular/forms";
import { DatabaseReference } from "@firebase/database";
import { JsonPrimitive, RtdbViewerStore } from "./rtdb-viewer.store";

@Component({
    selector: 'rtdb-realtime-node',
    template: `
        <span>{{ ref?.toString() }} {{ value }}</span>
        <button *ngIf="ref && value === null" (click)="store.addChildEditor(ref)">Add child</button>`,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbRealtimeNodeComponent {
    @Input() ref?: DatabaseReference;
    @Input() value?: JsonPrimitive;

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-editor-node',
    template: `
        <span>p:{{ path }}</span>
        <span>--</span>
        <span>r:{{ ref?.toString() }}</span>
        <input *ngIf="keyControl" [formControl]="keyControl" placeholder="key" />
        <input *ngIf="valueControl" [formControl]="valueControl" placeholder="value" />
        <button (click)="remove()">x</button>
        <button *ngIf="!valueControl || valueControl.value === ''" (click)="addChild()">+</button>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbEditorNodeComponent {
    @Input() ref?: DatabaseReference;
    @Input() keyControl?: FormControl;
    @Input() valueControl?: FormControl;
    @Input() path?: number[];

    remove() {
        if (this.ref && this.path) {
            this.store.removeChildEditor({ref: this.ref, path: this.path});
        }
    }

    addChild() {
        if (this.ref && this.path) {
            this.store.addChildEditor({ref: this.ref, path: this.path});
        }
    }

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-editor-leaf-node',
    template: `
        <span>p:{{ path }}</span>
        <span>--</span>
        <span>r:{{ ref?.toString() }}</span>
        <input *ngIf="keyControl" [formControl]="keyControl" placeholder="key" />
        <input *ngIf="valueControl" [formControl]="valueControl" placeholder="value" />
        <button (click)="remove()">x</button>
        <button (click)="addChild()">+</button>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbEditorLeafNodeComponent {
    @Input() ref?: DatabaseReference;
    @Input() keyControl?: FormControl;
    @Input() valueControl?: FormControl;
    @Input() path?: number[];

    remove() {
        if (this.ref && this.path) {
            this.store.removeChildEditor({ref: this.ref, path: this.path});
        }
    }

    addChild() {
        if (this.ref && this.path) {
            this.store.addChildEditor({ref: this.ref, path: this.path});
        }
    }

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-editor-child-node',
    template: `
        <span>p:{{ path }}</span>
        <span>with child...</span>
        <span>r:{{ ref?.toString() }}</span>
        <input *ngIf="keyControl" [formControl]="keyControl" placeholder="key" />
        <button (click)="remove()">x</button>
        <button (click)="addChild()">+</button>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbEditorChildNodeComponent {
    @Input() ref?: DatabaseReference;
    @Input() keyControl?: FormControl;
    @Input() path?: number[];

    remove() {
        if (this.ref && this.path) {
            this.store.removeChildEditor({ref: this.ref, path: this.path});
        }
    }

    addChild() {
        if (this.ref && this.path) {
            this.store.addChildEditor({ref: this.ref, path: this.path});
        }
    }

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-save-node',
    template: `
        <button *ngIf="control" [disabled]="control.invalid">Save</button>
    `,
    styles: [`
        :host {
            display: block;
        } 
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbSaveNodeComponent {
    @Input() ref?: DatabaseReference;
    @Input() control?: FormArray;

    constructor(readonly store: RtdbViewerStore) { }
}