import { Plugin } from "obsidian";

export default class AskBetweenTheLines extends Plugin {
  async onload() {
    console.log("Ask Between the Lines loaded");
  }

  async onunload() {
    console.log("Ask Between the Lines unloaded");
  }
}
