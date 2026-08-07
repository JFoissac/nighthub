import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ToastContainerComponent } from './components/toast/toast-container.component';

@Component({
  imports: [RouterModule, DashboardComponent, ToastContainerComponent],
  selector: 'app-root',
  template: `
    <app-dashboard></app-dashboard>
    <app-toast-container></app-toast-container>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }
  `],
})
export class App {}