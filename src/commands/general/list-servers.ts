import {inlineCode} from '@discordjs/builders';
import {ApplyOptions} from '@sapphire/decorators';
import {Command} from '@sapphire/framework';
import { MessageActionRow, MessageButton} from 'discord.js';
import {createInfoEmbed} from '../../lib/utils/embeds';

import {curated_links_object} from '../../index';
import type { Curated_Server } from '../../lib/curated-links';

@ApplyOptions<Command.Options>({description: 'List approved discord servers'})
export class ListServersCommand extends Command {
    private async generateEmbed(page: number, max_page: number, servers_list: any) {
        let servers_list_page = servers_list.slice(page*5, (page+1)*5);
    
        let embed = createInfoEmbed(
            [
                'List of approved discord servers',
                '🐌 Servers:',
                servers_list_page.map((server: Curated_Server, index: number) => `┣ ${index+1}. ${inlineCode(server.name)} | ${inlineCode(`discord.gg/${server.invite_code}`)}`).join('\n'),
                `Page ${page+1} of ${max_page+1}`
            ].join('\n')
        );
    
        return embed;
    }

    public override async chatInputRun(
        interaction: Command.ChatInputInteraction
    ) {   

        let servers_list = curated_links_object.getCuratedDiscordServers();
    
        let page = 0;
        let max_page = Math.floor(servers_list.length / 5);

        let embed = await this.generateEmbed(page, max_page, servers_list);

        // if there are more than 5 servers, only show the first 5 and have a message action row to show the rest
        if (servers_list.length > 5) {
            await interaction.reply({
                embeds: [embed],
                ephemeral: true,
                fetchReply: true,
            });

            let row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle('PRIMARY')
                        .setDisabled(true),
                    new MessageButton()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle('PRIMARY')
                        .setDisabled(false)
                );

            await interaction.editReply({embeds: [embed], components: [row]});
            const filter = (i: any) => i.customId === 'prev' || i.customId === 'next';
            const collector = interaction!.channel!.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async (i:any) => {
                if (i.customId === 'prev') {
                    page = page === 0 ? 0 : page - 1;
                } else if (i.customId === 'next') {
                    page = page === max_page ? max_page : page + 1;
                }
            
                embed = await this.generateEmbed(page, max_page, servers_list);

                await interaction.editReply({embeds: [embed], components: [row]});

            }

        } else {
            await interaction.reply({embeds: [embed], ephemeral: true});
        }
    }
}