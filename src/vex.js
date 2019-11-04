import { MessageEmbed } from 'discord.js';
import { decode } from 'he';

import { client, db } from '.';
import { decodeEvent, decodeGrade, decodeProgram, decodeProgramEmoji, decodeRound, decodeSeason, decodeSeasonUrl, decodeSkill, emojiToUrl } from './dbinfo';

const getTeamId = (message, args) => {
  const arg = args.replace(/\s+/g, '');
  if (arg) {
    return arg.toUpperCase();
  }
  return (message.member ? message.member.displayName : message.author.username).split(' | ', 2)[1];
};

const validTeamId = teamId => /^([0-9]{1,5}[A-Z]?|[A-Z]{2,5}[0-9]{0,2})$/i.test(teamId);

const getTeam = (teamId, season) => {
  let query = {
    '_id.id': new RegExp(`^${teamId}$`, 'i'),
    '_id.program': (isNaN(teamId.charAt(0)) ? 4 : 1)
  };
  const teams = db.collection('teams');
  if (season != null) {
    query['_id.season'] = season;
    return teams.findOne(query);
  }
  return teams.find(query).sort({'_id.season': -1}).toArray();
};

const getTeamLocation = team => {
  let location = [team.city];
  if (team.region) {
    location.push(team.region);
  }
  if (team.country) {
    location.push(team.country);
  }
  return location.join(', ');
};

const createTeamEmbed = team => {
  const teamId = team._id.id;
  const program = decodeProgram(team._id.program);
  const season = team._id.season;
  const location = getTeamLocation(team);
  const embed = new MessageEmbed()
    .setColor('GREEN')
    .setAuthor(teamId, emojiToUrl(decodeProgramEmoji(team._id.program)), `https://www.robotevents.com/teams/${program}/${teamId}`)
    .setTitle(decodeSeason(season))
    .setURL(decodeSeasonUrl(season));
  if (team.name) {
    embed.addField('Team Name', team.name, true);
  }
  if (team.robot) {
    embed.addField('Robot Name', team.robot, true);
  }
  if (team.org) {
    embed.addField('Organization', team.org, true);
  }
  if (location) {
    embed.addField('Location', location, true);
  }
  if (team.grade) {
    embed.addField('Grade', decodeGrade(team.grade), true);
  }
  return embed;
};

const createEventEmbed = event => {
  const embed = new MessageEmbed()
    .setColor('ORANGE')
    .setAuthor(event.name, emojiToUrl(decodeProgramEmoji(event.program)), `https://www.robotevents.com/${event._id}.html`)
    .setTitle(`${event.tsa ? 'TSA ' : ''}${decodeSeason(event.season)}`)
    .setURL(decodeSeasonUrl(event.season))
    .setDescription(decodeEvent(event.type))
    .setTimestamp(new Date(event.start))
    .addField('Spots Open', `${event.spots}/${event.capacity}`, true)
    .addField('Price', `$${event.price}`, true)
    .addField('Grade', decodeGrade(event.grade), true)
    .addField('Skills Offered?', event.skills ? 'Yes' : 'No', true);
  return embed;
};

const maskedTeamUrl = (program, teamId) => `[${teamId}](https://www.robotevents.com/teams/${decodeProgram(program)}/${teamId})`;

const createMatchString = (round, instance, number) => `${decodeRound(round)}${round < 3 || round > 8 ? '' : ` ${instance}-`}${number}`;

const createTeamsString = (program, teams, teamSit, scored) => {
  return teams.filter(team => team).map((team, _, array) => {
    program = isNaN(team.charAt(0)) ? 4 : program;
    const teamLink = maskedTeamUrl(program, team);
    if (!scored) {
      return teamLink;
    }
    if (array.length > 2 && team === teamSit) {
      return `*${teamLink}*`;
    }
    return `**${teamLink}**`;
  }).join(' ');
};

const allianceEmojis = ['🔴', '🔵'];

const matchScoredNotification = match => {
  const matchString = createMatchString(match._id.round, match._id.instance, match._id.number);
  const redTeams = match.red.filter(team => team && team !== match.redSit);
  const blueTeams = match.blue.filter(team => team && team !== match.blueSit);
  return `${matchString} ${redTeams[0]}${redTeams[1] ? ` ${redTeams[1]}` : ''}${allianceEmojis[0]}${match.redScore}-${match.blueScore}${allianceEmojis[1]}${blueTeams[1] ? `${blueTeams[1]} ` : ''}${blueTeams[0]}`;
};

const createMatchEmbed = (match, event) => {
  let color;
  if (match.redScore !== undefined) {
    color = 0xffffff;
  } else if (match.program === 41) {
    color = 'BLUE';
  } else if (match.redScore === match.blueScore) {
    color = 'GREY';
  } else {
    color = (match.redScore > match.blueScore) ? 'RED' : 'BLUE';
  }
  let red = `${allianceEmojis[0]} Red`;
  let blue = `${allianceEmojis[1]} Blue`;
  let alliance = allianceEmojis[1];
  if (match.redScore !== undefined || match.redScorePred !== undefined) {
    red += ':';
    blue += ':';
    if (match.redScore !== undefined) {
      red += ` ${match.redScore}`;
      blue += ` ${match.blueScore}`;
    }
    if (match.redScorePred !== undefined) {
      red += ` (${match.redScorePred} predicted)`;
      blue += ` (${match.blueScorePred} predicted)`;
    }
  } else if (match.score !== undefined || match.scorePred !== undefined) {
    alliance += ' Score:';
    if (match.score !== undefined) {
      alliance += ` ${match.score}`;
    }
    if (match.scorePred !== undefined) {
      alliance += ` (${match.scorePred} predicted)`;
    }
  }
  const embed = new MessageEmbed()
    .setColor(color)
    .setAuthor(event.name, emojiToUrl(decodeProgramEmoji(match.program)), `https://www.robotevents.com/${match._id.event}.html`)
    .setTitle(event.divisions[match._id.division])
    .setURL(`https://www.robotevents.com/${match._id.event}.html#tab-results`)
    .setDescription(createMatchString(match._id.round, match._id.instance, match._id.number));
  if (match.program === 41) {
    if (match.teams.length) {
      embed.addField(alliance, createTeamsString(match.program, match.teams));
    }
  } else {
    if (match.red.length) {
      embed.addField(red, createTeamsString(match.program, match.red, match.redSit), true);
    }
    if (match.blue.length) {
      embed.addField(blue, createTeamsString(match.program, match.blue, match.blueSit), true);
    }
  }
  if (match.started !== undefined) {
    embed.setTimestamp(new Date(match.started));
  } else if (match.scheduled !== undefined) {
    embed.setTimestamp(new Date(match.scheduled));
  }
  return embed;
};

const createAwardEmbed = async award => {
  const skus = award.qualifies ? award.qualifies.slice() : [];
  skus.unshift(award._id.event);
  const events = await db.collection('events').find({_id: {$in: skus}}).project({_id: 1, name: 1}).toArray();
  let eventName;
  events.forEach(event => {
    if (event._id === award._id.event) {
      eventName = event.name;
    } else {
      award.qualifies[award.qualifies.indexOf(event._id)] = `[${event.name}](https://www.robotevents.com/${event._id}.html)`;
    }
  });
  const embed = new MessageEmbed()
    .setColor('PURPLE')
    .setAuthor(eventName)
    .setTitle(award._id.name)
    .setURL(`https://www.robotevents.com/${award._id.event}.html#tab-awards`);
  if (award.team) {
    embed.addField('Team', `${decodeProgramEmoji(award.team.program)} [${award.team.id}](https://www.robotevents.com/teams/${decodeProgram(award.team.program)}/${award.team.id})`, true);
  }
  if (award.qualifies) {
    embed.addField('Qualifies for', award.qualifies.join('\n'), true);
  }
  return embed;
};

const createSkillsEmbed = (skill, event) => {
  const program = decodeProgram(skill.team.program);
  return new MessageEmbed()
    .setColor('GOLD')
    .setAuthor(event.name, null, `https://www.robotevents.com/${event._id}.html#tab-results`)
    .setTitle(`${program} ${skill.team.id}`)
    .setURL(`https://www.robotevents.com/teams/${program}/${skill.team.id}`)
    .addField('Type', decodeSkill(skill._id.type), true)
    .addField('Rank', skill.rank, true)
    .addField('Score', skill.score, true)
    .addField('Attempts', skill.attempts, true);
};

const getMatchTeams = match => (match.teams || match.red.concat(match.blue)).filter(team => team).map(team => {
  return {program: (isNaN(team.charAt(0)) ? 4 : match.program), id: team};
});

const sendMatchEmbed = async (content, match, event, reactions) => {
  try {
    await sendToSubscribedChannels((match.redScore !== undefined ? `${matchScoredNotification(match)}\n${content}` : content), {embed: createMatchEmbed(match, event)}, getMatchTeams(match), reactions);
  } catch (err) {
    console.error(err);
  }
};

const subscribedChannels = [
  '352003193666011138',
  '329477820076130306'  // Dev server.
];

const sendToSubscribedChannels = async (content, options, teams = [], reactions = []) => {
  subscribedChannels.forEach(async id => {
    const channel = client.channels.get(id);
    if (channel) {
      try {
        let subscribers = [];
        for (let team of teams) {
          const teamSubs = await db.collection('teamSubs').find({_id: {guild: channel.guild.id, team: team}}).toArray();
          for (let teamSub of teamSubs) {
            for (let user of teamSub.users) {
              if (subscribers.indexOf(user) < 0) {
                subscribers.push(user);
              }
            }
          }
        }
        let text;
        if (subscribers.length) {
          text = subscribers.map(subscriber => `<@${subscriber}>`).join('');
        }
        if (content) {
          text = text ? `${content}\n${text}` : content;
        }
        const message = await channel.send(text ? text : undefined, options).catch(console.error);
        for (let reaction of reactions) {
          await message.react(reaction);
        }
      } catch (err) {
        console.error(err);
      }
    }
  });
};

const escapeMarkdown = string => string ? string.replace(/([*^_`~])/g, '\\$1') : '';

const createTeamChangeEmbed = (program, teamId, field, oldValue, newValue) => {
  program = decodeProgram(program);
  let change;
  if (!oldValue) {
    change = `added their ${field} **"**${escapeMarkdown(decode(newValue))}**"**`;
  } else if (!newValue) {
    change = `removed their ${field} **"**${escapeMarkdown(decode(oldValue))}**"**`;
  } else {
    change = `changed their ${field} from **"**${escapeMarkdown(decode(oldValue))}**"** to **"**${escapeMarkdown(decode(newValue))}**"**`;
  }
  return new MessageEmbed()
    .setColor('GREEN')
    .setDescription(`[${program} ${teamId}](https://www.robotevents.com/teams/${program}/${teamId}) ${change}.`);
};

export {
  getTeamId,
  validTeamId,
  getTeam,
  getTeamLocation,
  createTeamEmbed,
  createEventEmbed,
  createMatchEmbed,
  createSkillsEmbed,
  createAwardEmbed,
  createTeamChangeEmbed,
  sendToSubscribedChannels,
  sendMatchEmbed
};
