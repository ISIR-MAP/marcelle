import { DashboardPage } from './dashboard_page';
import DashboardComponent from './Dashboard.svelte';
import { Stream } from '../../core';
import { DashboardSettings } from './dashboard_settings';

export interface DashboardOptions {
  title: string;
  author: string;
  closable?: boolean;
}

export class Dashboard {
  pages: Record<string, DashboardPage> = {};
  app?: DashboardComponent;
  settings = new DashboardSettings();

  $active = new Stream(false as boolean, true);
  $currentPageName = new Stream('', true);

  title: string;
  author: string;
  closable: boolean;

  constructor({
    title = 'Hello, Marcelle!',
    author = 'author',
    closable = false,
  }: DashboardOptions) {
    this.title = title;
    this.author = author;
    this.closable = closable;
  }

  page(name: string, showSidebar?: boolean): DashboardPage {
    if (!Object.keys(this.pages).includes(name)) {
      this.pages[name] = new DashboardPage(name, showSidebar);
    }
    return this.pages[name];
  }

  show(): void {
    this.app = new DashboardComponent({
      target: document.body,
      props: {
        title: this.title,
        author: this.author,
        pages: this.pages,
        settings: this.settings,
        currentPageName: this.$currentPageName,
        closable: this.closable,
      },
    });
    this.$active.set(true);
    this.app.$on('quit', () => {
      this.$active.set(false);
      this.app?.$destroy();
      for (const panel of Object.values(this.pages)) {
        panel.destroy();
      }
      this.app = undefined;
    });
  }

  hide(): void {
    this.app?.quit();
  }
}

export function dashboard(options: DashboardOptions): Dashboard {
  return new Dashboard(options);
}
