import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RtdbViewerComponent, RtdbViewerToggleComponent } from './rtdb-viewer.component';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ReactiveFormsModule } from '@angular/forms';
import { RtdbEditorNodeComponent, RtdbRealtimeNodeComponent, RtdbRestNodeComponent, RtdbSaveNodeComponent } from './rtdb-node.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule, ScrollingModule, HttpClientModule],
  declarations: [RtdbEditorNodeComponent, RtdbRestNodeComponent, RtdbViewerToggleComponent, RtdbSaveNodeComponent, RtdbRealtimeNodeComponent, RtdbViewerComponent],
  exports: [RtdbViewerComponent],
})
export class RtdbViewerModule { }
