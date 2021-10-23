import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { RtdbViewerModule } from './rtdb-viewer/rtdb-viewer.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    RtdbViewerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
