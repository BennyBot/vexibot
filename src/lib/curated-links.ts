import { LocalStorage } from 'node-localstorage';

export interface Curated_Server {
    name: string;
    invite_code: string;
    tags?: string[];
}

export const max_invalid_servers: number = 3;

export interface Sender_Tracker {
    sender_id: string;
    count: number;
}



export class CuratedLinks {
    private curated_links: Curated_Server[];
    private sender_tracking: Sender_Tracker[] = [];
    private localStorage: LocalStorage;

    constructor() {
        this.curated_links = [];
        this.localStorage = new LocalStorage('./localstorage');
    }

    async init() {
        await this.fetchCuratedDiscordServers();
        await this.saveCuratedDiscordServers();
        console.log("Curated Links Initialized");
        console.log(this.curated_links);
    }

    async fetchCuratedDiscordServers() {
        let inital_data: string = this.localStorage.getItem('curated_links') ?? "[]";
        console.log(`Initial Data :: ${inital_data}`);
        let current_curated_data = JSON.parse(inital_data);
        console.log(`Current Curated Data :: ${JSON.stringify(current_curated_data)}`);
        if (!current_curated_data) {
            this.curated_links = [];
            return;
        }
        for (const l of current_curated_data) {
            let server: Curated_Server = {
                name: l.name,
                invite_code: l.invite_code,
                tags: l?.tags ?? []
            };
            this.curated_links.push(server);
        }
    }

    async fetchSenderTrackers() {
        let inital_data: string = this.localStorage.getItem('sender_tracking') ?? "[]";
        console.log(`Initial Data :: ${inital_data}`);
        let current_sender_tracking = JSON.parse(inital_data);
        console.log(`Current Sender Tracking :: ${JSON.stringify(current_sender_tracking)}`);
        if (!current_sender_tracking) {
            this.sender_tracking = [];
            return;
        }
        for (const l of current_sender_tracking) {
            let sender: Sender_Tracker = {
                sender_id: l.sender_id,
                count: l.count
            };
            this.sender_tracking.push(sender);
        }
    }

    async saveCuratedDiscordServers() {
        this.localStorage.setItem('curated_links', JSON.stringify(this.curated_links));
        console.log(`Saved Curated Links :: ${JSON.stringify(this.curated_links)}`);
    }

    async saveSenderTrackers() {
        this.localStorage.setItem('sender_tracking', JSON.stringify(this.sender_tracking));
        console.log(`Saved Sender Tracking :: ${JSON.stringify(this.sender_tracking)}`);
    }

    async addCuratedDiscordServer(server: Curated_Server) {
        this.curated_links.push(server);
        await this.saveCuratedDiscordServers();
    }

    async removeCuratedDiscordServer(server: Curated_Server) {
        this.curated_links = this.curated_links.filter((item: any) => item !== server);
        await this.saveCuratedDiscordServers();
    }

    async warn_sender(sender_id: string): Promise<boolean> {
        let sender = this.sender_tracking.find((item: any) => item.sender_id === sender_id);
        if (!sender) {
            let new_sender: Sender_Tracker = {
                sender_id: sender_id,
                count: 1
            };
            this.sender_tracking.push(new_sender);
        } else {
            sender.count += 1;
        } 
        await this.saveSenderTrackers();
        return (sender?.count ?? 0) >= max_invalid_servers;
    }
    
    getCuratedDiscordServers() {
        return this.curated_links;
    }

    async isCuratedDiscordServer(server_code: any) {
        // check if any of the curated servers have the same invite code
        let curated_server = this.curated_links.find((item: any) => item.invite_code === server_code);
        return curated_server !== undefined;
    }
}