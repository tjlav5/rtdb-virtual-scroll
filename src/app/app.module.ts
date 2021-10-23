import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { RtdbViewerModule } from './rtdb-viewer/rtdb-viewer.module';

@NgModule({
  imports: [BrowserModule, RtdbViewerModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
