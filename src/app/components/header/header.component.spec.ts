import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have date property', () => {
    expect(component.date).toBeDefined();
    expect(component.date instanceof Date).toBe(true);
  });

  it('should have time property', () => {
    expect(component.time).toBeDefined();
    expect(typeof component.time).toBe('string');
  });

  it('should have timezone property', () => {
    expect(component.timezone).toBeDefined();
    expect(typeof component.timezone).toBe('string');
  });

  it('should render NightHub title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('NightHub');
  });
});