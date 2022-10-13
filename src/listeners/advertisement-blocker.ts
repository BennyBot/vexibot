import {ApplyOptions} from '@sapphire/decorators';
import {Events, Listener} from '@sapphire/framework';
import type { Message } from 'discord.js';
import {curated_links_object} from '../index';




//const dev = nodeEnv === 'development';

@ApplyOptions<Listener.Options>({event: Events.MessageCreate, once: false})
export class MessageCreateListener extends Listener<typeof Events.MessageCreate> {

    public override run(message : Message) {
        // do nothing if the author has admin, mod, or vendor roles
        if (message.member?.roles.cache.some(role => role.name === 'Admin' || role.name === 'Moderator' || role.name === 'Vendor')) return;
        // do nothing if the bot sent the message
        if (message.author.bot) return;
        // do nothing if the message is not in a guild
        if (!message.guild) return;
        
        // check if message has discord.gg/ or discord.com/invite/ in it
        if (message.content.includes("discord.gg/") || message.content.includes("discord.com/invite/")) {

            let author = message.author;
            // get the code right after the discord.gg/ or discord.com/invite/
            let invite_code = message.content.split("discord.gg/")[1] ?? message.content.split("discord.com/invite/")[1];
            console.log(invite_code);
            // if the code is undefined, return
            if (invite_code === undefined) return;
            // if the code is not curated, delete the message

            curated_links_object.isCuratedDiscordServer(invite_code).then((response: any) => {
              console.log(`Response :: ${response}`);

              if (!response) {
                (async () => {
                  let ban = await curated_links_object.warn_sender(author.id);
                  try {
                    if (ban) {
                      await message.reply({content: "User has been banned for excessive advertising"});
                      await message.guild!.members.ban(author.id, {reason: "Advertising"});
                    } else {
                      await message.reply({content: `<@${author.id}> The invite you posted is not on the list of approved servers. Please contact an admin if you believe this is an error.`});
                    }
                    await message.delete();
                  } catch (error) {
                    console.log(error);
                  }
                })();
              }
            });
        }

        this.container.logger.info(message.content);
        console.log("eeeeeeee ");

    }
}
