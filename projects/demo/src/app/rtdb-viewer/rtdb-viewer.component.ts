import { animateChild, query, transition, trigger } from '@angular/animations';
import { CdkVirtualForOf } from '@angular/cdk/scrolling';
import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  Input,
} from '@angular/core';
import { throttleTime, debounceTime, tap, map, switchMap } from 'rxjs/operators';
import { FlatSnapshot, NodeType, relativeRefPath, RtdbNode, RtdbViewerStore } from './rtdb-viewer.store';
import { DatabaseReference } from '@firebase/database';
import { FormControl } from '@angular/forms';
import { combineLatest, Observable, of, ReplaySubject } from 'rxjs';

interface Toggle {
  expanded: boolean;
  refPath: string; 
}

@Component({
  selector: 'rtdb-viewer-toggle',
  template: `
    <ng-container *ngIf="toggle$ | async as toggle">
      <button *ngIf="toggle" (click)="toggle.expanded ? store.collapseNode(toggle.refPath) : store.expandNode(toggle.refPath)">
        <ng-container *ngIf="toggle.expanded; else collapsed">X</ng-container>
        <ng-template #collapsed>+</ng-template>
      </button>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbViewerToggleComponent {
  @Input()
  set canToggle(canToggle: boolean) {
    this.canToggle$.next(canToggle);
  }
  private readonly canToggle$ = new ReplaySubject<boolean>(1);

  @Input()
  set refPath(refPath: string) {
    this.refPath$.next(refPath);
  }
  private readonly refPath$ = new ReplaySubject<string>(1);

  readonly toggle$: Observable<Toggle|null> = combineLatest([this.canToggle$, this.refPath$]).pipe(
    switchMap(([canToggle, refPath]) => {
      if (!canToggle) {
        return of(null);
      } else {
        return this.store.collapsedRefs$.pipe(map(collapsedRefs => {
          return collapsedRefs.has(refPath) ? {expanded: false, refPath} : {expanded: true, refPath};
        }));
      }
    }),
  );

  constructor(readonly store: RtdbViewerStore) { }
}

@Component({
  selector: 'rtdb-viewer',
  template: `
    <input [formControl]="query" placeholder="Ctrl-f" />
    <button *ngIf="nextIndex$ | async as index" (click)="viewport.scrollToIndex(index)">Next</button>
    <cdk-virtual-scroll-viewport itemSize="50" #viewport (scrolledIndexChange)="onIndexChanged($event)">
      <div
        *cdkVirtualFor="let item of store; trackBy: trackByRtdbNode; templateCacheSize: 0"
        [style.--level]="item.level"
        [@.disabled]="isScrolling"
        [@rtdbAddRemove]
      >
        <rtdb-viewer-toggle [canToggle]="item.isExpandable" [refPath]="item.refPath"></rtdb-viewer-toggle>

        <ng-container [ngSwitch]="item.type">
          <rtdb-realtime-node *ngSwitchCase="NodeType.REALTIME" [refPath]="item.refPath" [snapshot]="item.snapshot"></rtdb-realtime-node>
          <rtdb-editor-node *ngSwitchCase="NodeType.EDITOR" [refPath]="item.refPath" [keyControl]="item.keyControl" [valueControl]="item.valueControl" [path]="item.path"></rtdb-editor-node>
          <rtdb-save-node *ngSwitchCase="NodeType.SAVE" [refPath]="item.refPath" [control]="item.formControl"></rtdb-save-node>
        </ng-container>
      </div>
  `,
  animations: [
    trigger('rtdbAddRemove', [
      // transition(':enter', [query('@*', animateChild())]),
      // transition(':leave', [query('@*', animateChild())]),
    ]),
  ],
  styles: [
    `
      :host {
        display: block;
      }

      cdk-virtual-scroll-viewport {
        border: 1px solid black;
        height: 100%;
      }

      div {
        display: grid;
        grid-template-columns: min-content 1fr;
        margin-left: calc(24px * var(--level));
        place-items: baseline;
      }

      rtdb-realtime-node,
      rtdb-editor-node,
      rtdb-save-node {
        height: 50px;
      }
    `,
  ],
  providers: [RtdbViewerStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbViewerComponent {
  readonly NodeType = NodeType;

  isScrolling = false;

  @Input()
  set ref(ref: DatabaseReference | undefined) {
    this.store.setRootRef(ref);
  }

  @ViewChild(CdkVirtualForOf, { static: true })
  private readonly virtualForOf?: CdkVirtualForOf<{}>;

  readonly query = new FormControl('');

  private readonly scrolledIndex$ = new ReplaySubject<number>(1);

  readonly nextIndex$ = combineLatest([this.store.queryResults$, this.scrolledIndex$]).pipe(map(([results, scrolledIndex]) => {
    for (const index of results) {
      if (index > scrolledIndex) {
        return index;
      }
    }
  }));

  constructor(
    readonly store: RtdbViewerStore,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.query.valueChanges.subscribe((v) => {
      store.setQuery(v);
    });
  }

  ngOnInit() {
    this.virtualForOf?.viewChange
      .pipe(
        throttleTime(10),
        tap(() => {
          this.isScrolling = true;
          this.cdr.markForCheck();
        }),
        debounceTime(100)
      )
      .subscribe(() => {
        this.isScrolling = false;
        this.cdr.markForCheck();
      });
  }

  onIndexChanged(index: number) {
    this.scrolledIndex$.next(index);
  }

  trackByRtdbNode(index: number, node: RtdbNode) {
    return node.refPath;
  }
}
