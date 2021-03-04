import { ProjectData } from './project-data';

interface MessageRequest {
    type: "cancel_job" | "get_supported_jobs" | "get_server_stats";
}

interface MessageNewJob {
    type: "new_job";
    platform: "fitkit2";
    name: string;
    userArgs: string[];
}

interface MessageJobData {
    type: "job_data";
    data: ProjectData;
}

/**
 * Websocket zpráva klient -> server
 */
export type ClientMessage = MessageRequest | MessageNewJob | MessageJobData;
