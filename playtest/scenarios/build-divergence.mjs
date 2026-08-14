import { VerdigrisGeometricTree } from '../../src/core/passives/verdigris-geometric-tree.js';

const allocateNodeToward = (tree, nodeId, axis) => {
  tree.handleNodeClick(nodeId);
  const choices = tree.getPendingChoices();
  if (!choices.length) return;
  const choice = choices.sort((left, right) => {
    const leftOption = tree.conduits.get(left.conduitId)?.getOption(left.optionId);
    const rightOption = tree.conduits.get(right.conduitId)?.getOption(right.optionId);
    return (rightOption?.attrs?.[axis] || 0) - (leftOption?.attrs?.[axis] || 0);
  })[0];
  tree.handleConduitClick(choice.conduitId, choice.optionId);
};

const axisBuild = (axis) => {
  const tree = new VerdigrisGeometricTree({ availablePoints: 20 });
  const route = axis === 'STR'
    ? [...Array.from({ length: 9 }, (_, index) => `${-(index + 1)},${index + 1}`), '-9,8']
    : [...Array.from({ length: 9 }, (_, index) => `${index + 1},0`), '9,-1'];
  route.forEach(nodeId => allocateNodeToward(tree, nodeId, axis));
  return tree.snapshot();
};

const resetMonster = async (player, monsterUuid) => {
  player.devResetMonster(monsterUuid, { maxHealth: 500 });
  return player.waitFor(async () => {
    const state = await player.state();
    return state.monsters.find(monster => monster.uuid === monsterUuid
      && monster.hp.current === 500) || false;
  }, { label: 'shared build-comparison monster reset' });
};

const hitOnce = async (player, target, skillId) => {
  const hitsBefore = player.hits.length;
  player.devHeal();
  player.devTeleport(Math.round(target.x) + 1, Math.round(target.y));
  if (skillId === 'primary-attack') {
    await player.attack(target);
  } else {
    player.useSkill(skillId, 'left');
  }
  return player.waitFor(() => player.hits.slice(hitsBefore)
    .find(hit => hit.targetId === target.uuid && hit.skillId === skillId && hit.amount > 0) || false, {
    timeoutMs: 8000,
    label: `${skillId} build-comparison hit`,
  });
};

export default async function buildDivergence({ connect, assert }) {
  const strength = await connect({
    guestId: 'build-str-player', houseName: 'House Might', scionName: 'Bran',
  });
  const intellect = await connect({
    guestId: 'build-int-player', houseName: 'House Ember', scionName: 'Ilyra',
  });
  try {
    strength.createParty();
    await strength.waitFor(() => strength.party, { label: 'build party creation' });
    strength.invitePlayer(intellect.player.username);
    const invite = await intellect.waitFor(() => intellect.partyInvites[0], { label: 'build party invite' });
    intellect.acceptPartyInvite(invite.partyId);
    await strength.waitFor(() => strength.party?.members?.length === 2, { label: 'build party joined' });
    strength.togglePartyReady();
    intellect.togglePartyReady();
    await strength.waitFor(() => strength.party?.members?.every(member => member.ready), { label: 'build party ready' });
    const strengthTransitions = strength.sceneTransitions || 0;
    const intellectTransitions = intellect.sceneTransitions || 0;
    strength.startPartyInstance();
    await strength.waitFor(() => (strength.sceneTransitions || 0) > strengthTransitions, { label: 'STR instance entry' });
    await intellect.waitFor(() => (intellect.sceneTransitions || 0) > intellectTransitions, { label: 'INT instance entry' });

    strength.devSetLevel(20);
    intellect.devSetLevel(20);
    strength.saveSkillTree(axisBuild('STR'));
    intellect.saveSkillTree(axisBuild('INT'));
    const strengthState = await strength.waitFor(async () => {
      const state = await strength.state();
      return state.passiveTree?.points?.skill === 0 ? state : false;
    }, { label: '20-point STR build' });
    const intellectState = await intellect.waitFor(async () => {
      const state = await intellect.state();
      return state.passiveTree?.points?.skill === 0 ? state : false;
    }, { label: '20-point INT build' });
    assert(strengthState.attributes.strength > intellectState.attributes.strength,
      `STR path leads strength (${strengthState.attributes.strength} vs ${intellectState.attributes.strength})`);
    assert(intellectState.attributes.intelligence > strengthState.attributes.intelligence,
      `INT path leads intelligence (${intellectState.attributes.intelligence} vs ${strengthState.attributes.intelligence})`);

    const target = strengthState.monsters
      .filter(monster => monster.rarity !== 'elite')
      .sort((a, b) => a.hp.max - b.hp.max)[0];
    assert(target, 'both builds face one shared monster');
    const parking = { x: target.x + 20, y: target.y + 20 };

    let comparison = await resetMonster(strength, target.uuid);
    const strengthMelee = await hitOnce(strength, comparison, 'primary-attack');
    strength.devTeleport(parking.x, parking.y);
    comparison = await resetMonster(strength, target.uuid);
    const intellectMelee = await hitOnce(intellect, comparison, 'primary-attack');
    intellect.devTeleport(parking.x, parking.y);
    // The live combat input buffer enforces a 350ms global cooldown between
    // profile samples, just as it does for quickbar presses in the client.
    await new Promise(resolve => { setTimeout(resolve, 450); });
    comparison = await resetMonster(strength, target.uuid);
    const strengthSkill = await hitOnce(strength, comparison, 'ability-2');
    strength.devTeleport(parking.x, parking.y);
    comparison = await resetMonster(strength, target.uuid);
    const intellectSkill = await hitOnce(intellect, comparison, 'ability-2');

    assert(strengthMelee.amount >= intellectMelee.amount * 1.15,
      `STR build wins melee profile (${strengthMelee.amount} vs ${intellectMelee.amount})`);
    assert(intellectSkill.amount >= strengthSkill.amount * 1.15,
      `INT build wins skill profile (${intellectSkill.amount} vs ${strengthSkill.amount})`);
  } finally {
    intellect.close();
    strength.close();
  }
}
