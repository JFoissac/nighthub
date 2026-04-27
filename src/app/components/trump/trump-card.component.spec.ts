import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TrumpCardComponent } from './trump-card.component';
import { TrumpItem } from '../../models';

describe('TrumpCardComponent', () => {
  let component: TrumpCardComponent;
  let fixture: ComponentFixture<TrumpCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrumpCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrumpCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have item input defined', () => {
    expect(component.item).toBeDefined();
  });

  describe('getTypeIcon', () => {
    it('should return icon based on type', () => {
      expect(typeof component.getTypeIcon()).toBe('string');
    });
  });

  describe('getTypeClass', () => {
    it('should return class based on type', () => {
      expect(typeof component.getTypeClass()).toBe('string');
    });
  });
});