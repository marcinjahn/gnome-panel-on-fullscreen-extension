import { HotEdge } from "./edges/hot-edge";
import { isFullscreen, isInOverview } from "./utils/display";
import { delay, disposeDelayTimeouts } from "./utils/delay";
import { PanelManager } from "./panel/panel-manager";
import { WaylandPanelManager } from "panel/wayland-panel-manager";
import { X11PanelManager } from "panel/x11-panel-manager";
import {
  getPanelHeight,
  isAnyPanelMenuOpen,
  toggleAnyIndicator,
} from "panel/utils";

const Main = imports.ui.main;
const Meta = imports.gi.Meta;

class Extension {
  private uuid: string | null = null;
  private hotEdge: HotEdge | null = null;
  private hotCornersSub: any = null;
  private panelManager: PanelManager | null = null;

  constructor(uuid: string) {
    this.uuid = uuid;
  }

  enable() {
    log(`Enabling extension ${this.uuid}`);

    if (Meta.is_wayland_compositor()) {
      this.panelManager = new WaylandPanelManager();
    } else {
      this.panelManager = new X11PanelManager();
    }

    const layoutManager = Main.layoutManager;
    this.hotCornersSub = layoutManager.connect("hot-corners-changed", () => {
      this.setupHotEdge();
    });

    this.setupHotEdge();
  }

  setupHotEdge() {
    this.hotEdge?.dispose();

    const primaryMonitor = Main.layoutManager.primaryMonitor;

    this.hotEdge = new HotEdge(
      primaryMonitor,
      getPanelHeight(),
      () => {
        log("on trigger");
        if (!isFullscreen(primaryMonitor)) {
          return;
        }

        log("SHOW");

        this.panelManager?.showPanel();
      },
      () => {
        log("on leave");
        if (!isFullscreen(primaryMonitor) || isInOverview()) {
          this.panelManager?.resetAnyTweaks();
          toggleAnyIndicator();
          return;
        }
        log("delay");
        delay(200).then(() => {
          if (!isFullscreen(primaryMonitor) || isInOverview()) {
            this.panelManager?.resetAnyTweaks();
            toggleAnyIndicator();
            return;
          }
          log("HIDE");

          this.panelManager?.hidePanel();
        });
      },
      () => {
        const panelsNotOpen = !isAnyPanelMenuOpen();
        const isOverview = isInOverview();
        log("any panel open: " + !panelsNotOpen);
        log("is overview: " + isOverview);
        return panelsNotOpen || isOverview;
      }
    );

    this.hotEdge.initialize();
    Main.layoutManager.hotCorners.push(this.hotEdge);
  }

  disable() {
    log(`Disabling extension ${this.uuid}`);

    this.hotEdge?.dispose();
    this.hotEdge = null;

    Main.layoutManager.disconnect(this.hotCornersSub);
    this.hotCornersSub = null;

    this.panelManager?.dispose();
    this.panelManager = null;

    disposeDelayTimeouts();

    Main.layoutManager._updateHotCorners();
  }
}

export default function (meta: { uuid: string }): Extension {
  return new Extension(meta.uuid);
}
