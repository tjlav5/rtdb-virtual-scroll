import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RtdbViewerComponent, RtdbViewerToggleComponent } from './rtdb-viewer.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ReactiveFormsModule } from '@angular/forms';
import { RtdbEditorChildNodeComponent, RtdbEditorLeafNodeComponent, RtdbEditorNodeComponent, RtdbRealtimeNodeComponent, RtdbSaveNodeComponent } from './rtdb-node.component';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, ScrollingModule],
  declarations: [RtdbEditorNodeComponent, RtdbViewerToggleComponent, RtdbSaveNodeComponent, RtdbRealtimeNodeComponent, RtdbEditorChildNodeComponent, RtdbEditorLeafNodeComponent, RtdbViewerComponent],
  exports: [RtdbViewerComponent],
})
export class RtdbViewerModule { }
