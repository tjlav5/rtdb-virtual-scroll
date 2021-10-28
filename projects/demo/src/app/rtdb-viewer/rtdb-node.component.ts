import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
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
        <span>{{ ref?.toString() }} editor...</span>
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

    constructor(readonly store: RtdbViewerStore) { }
}

@Component({
    selector: 'rtdb-save-node',
    template: `
        <button>Save</button>
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

    constructor(readonly store: RtdbViewerStore) { }
}