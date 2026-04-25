import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

@Component({
  imports: [RouterModule, DashboardComponent],
  selector: 'app-root',
  template: '<app-dashboard></app-dashboard>',
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `],
})
export class App {}