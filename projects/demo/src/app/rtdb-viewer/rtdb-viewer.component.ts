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
import { throttleTime, debounceTime, tap, map } from 'rxjs/operators';
import { FlatSnapshot, RtdbNode, RtdbViewerStore } from './rtdb-viewer.store';
import { DatabaseReference } from '@firebase/database';
import { FormControl } from '@angular/forms';
import { combineLatest, ReplaySubject } from 'rxjs';

@Component({
  selector: 'rtdb-viewer',
  template: `
    <input [formControl]="query" placeholder="Ctrl-f" />
    <button *ngIf="nextIndex$ | async as index" (click)="viewport.scrollToIndex(index)">Next</button>
    <cdk-virtual-scroll-viewport itemSize="50" #viewport (scrolledIndexChange)="onIndexChanged($event)">
      <div
        *cdkVirtualFor="let item of store; trackBy: trackByRtdbNode; templateCacheSize: 0"
        [@.disabled]="isScrolling"
        [@rtdbAddRemove]
      >
        <button (click)="store.collapseNode(item.ref)">X</button>
        <button (click)="store.expandNode(item.ref)">+</button>
        <rtdb-realtime-node [ref]="item.ref" [value]="item.value"></rtdb-realtime-node>
        <!--
          rest-node
          editor-node
          save-node
        -->
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
        grid-template-columns: min-content min-content 1fr;
        place-items: baseline;
      }

      rtdb-realtime-node {
        height: 50px;
      }
    `,
  ],
  providers: [RtdbViewerStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RtdbViewerComponent {
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
    this.virtualForOf.viewChange
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
    return node.ref.toString();
  }
}
