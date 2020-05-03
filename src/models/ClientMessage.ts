import { ProjectData } from './ProjectData';

interface MessageProject{
	type: "build-begin" | "isim-begin";
	data: ProjectData;
}

interface MessageVoid{
	type: "build-end" | "isim-end";
}

/**
 * Websocket zpráva klient -> server
 */
export type ClientMessage = MessageVoid | MessageProject;
