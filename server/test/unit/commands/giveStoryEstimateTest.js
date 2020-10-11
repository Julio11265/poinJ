import {v4 as uuid} from 'uuid';

import {prepTwoUsersInOneRoomWithOneStory} from '../testUtils';

test('Should produce storyEstimateGiven event', async () => {
  const {roomId, storyId, userIdOne: userId, processor} = await prepTwoUsersInOneRoomWithOneStory();
  const commandId = uuid();

  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: 2
      }
    },
    userId
  ).then(({producedEvents}) => {
    expect(producedEvents).toMatchEvents(commandId, roomId, 'storyEstimateGiven');

    const [storyEstimateGivenEvent] = producedEvents;

    expect(storyEstimateGivenEvent.userId).toEqual(userId);
    expect(storyEstimateGivenEvent.payload.storyId).toEqual(storyId);
    expect(storyEstimateGivenEvent.payload.value).toBe(2);
  });
});

test('Should produce "revealed" event if everybody (allowed) estimated ', async () => {
  const {
    roomId,
    storyId,
    userIdOne,
    userIdTwo,
    processor
  } = await prepTwoUsersInOneRoomWithOneStory();
  const commandId = uuid();

  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: 4
      }
    },
    userIdOne // first user estimates story
  )
    .then(() =>
      processor(
        {
          id: commandId,
          roomId: roomId,
          name: 'giveStoryEstimate',
          payload: {
            storyId: storyId,
            value: 2
          }
        },
        userIdTwo // second user estimates story
      )
    )

    .then(({producedEvents}) => {
      expect(producedEvents).toMatchEvents(commandId, roomId, 'storyEstimateGiven', 'revealed');

      const [storyEstimateGivenEvent, revealedEvent] = producedEvents;

      expect(storyEstimateGivenEvent.payload.storyId).toEqual(storyId);
      expect(storyEstimateGivenEvent.payload.value).toBe(2);

      expect(revealedEvent.payload.storyId).toEqual(storyId);
      expect(revealedEvent.payload.manually).toBe(false);
    });
});

test('Should produce "consensusAchieved" and "revealed" event if everybody (allowed) estimated the same value', async () => {
  const {
    roomId,
    storyId,
    userIdOne,
    userIdTwo,
    processor
  } = await prepTwoUsersInOneRoomWithOneStory();
  const commandId = uuid();

  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: 2
      }
    },
    userIdOne // first user estimates "2"
  )
    .then(() =>
      processor(
        {
          id: commandId,
          roomId: roomId,
          name: 'giveStoryEstimate',
          payload: {
            storyId: storyId,
            value: 2
          }
        },
        userIdTwo // second user estimates "2"
      )
    )

    .then(({producedEvents, room}) => {
      expect(producedEvents).toMatchEvents(
        commandId,
        roomId,
        'storyEstimateGiven',
        'revealed',
        'consensusAchieved'
      );

      const [storyEstimateGivenEvent, revealedEvent, consensusAchievedEvent] = producedEvents;

      expect(storyEstimateGivenEvent.payload.storyId).toEqual(storyId);
      expect(storyEstimateGivenEvent.payload.value).toBe(2);

      expect(revealedEvent.payload.storyId).toEqual(storyId);
      expect(revealedEvent.payload.manually).toBe(false);

      expect(consensusAchievedEvent.payload).toEqual({
        storyId: storyId,
        value: 2
      });

      expect(room.stories[storyId].consensus).toBe(2);
    });
});

test('Should not produce revealed event if user changes his estimation', async () => {
  const {roomId, storyId, userIdOne: userId, processor} = await prepTwoUsersInOneRoomWithOneStory();
  const commandId = uuid();

  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: 2
      }
    },
    userId
  )
    .then(({producedEvents, room}) => {
      expect(producedEvents).toMatchEvents(commandId, roomId, 'storyEstimateGiven');

      const [storyEstimateGivenEvent] = producedEvents;

      expect(storyEstimateGivenEvent.userId).toEqual(userId);
      expect(storyEstimateGivenEvent.payload.storyId).toEqual(storyId);
      expect(storyEstimateGivenEvent.payload.value).toBe(2);

      // estimated value is stored on story in room
      expect(room.stories[storyId].estimations[userId]).toBe(2);
    })
    .then(() =>
      processor(
        {
          id: commandId,
          roomId: roomId,
          name: 'giveStoryEstimate',
          payload: {
            storyId: storyId,
            value: 5
          }
        },
        userId
      )
    )
    .then(({producedEvents, room}) => {
      expect(producedEvents).toMatchEvents(commandId, roomId, 'storyEstimateGiven');

      const [storyEstimateGivenEvent] = producedEvents;

      expect(storyEstimateGivenEvent.userId).toEqual(userId);
      expect(storyEstimateGivenEvent.payload.storyId).toEqual(storyId);
      expect(storyEstimateGivenEvent.payload.value).toBe(5);

      // estimated value is stored on story in room
      expect(room.stories[storyId].estimations[userId]).toBe(5);
    });
});

test('Should produce additional "revealed" and "consensusAchieved" events if all users estimated (only one user)', async () => {
  const {
    roomId,
    storyId,
    userIdOne: userId,
    userIdTwo,
    processor,
    mockStore
  } = await prepTwoUsersInOneRoomWithOneStory();

  mockStore.manipulate((room) => {
    delete room.users[userIdTwo];
    return room;
  });

  const commandId = uuid();
  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: 2
      }
    },
    userId
  ).then(({producedEvents}) =>
    expect(producedEvents).toMatchEvents(
      commandId,
      roomId,
      'storyEstimateGiven',
      'revealed',
      'consensusAchieved'
    )
  );
});

test('Should produce additional "revealed" and "consensusAchieved" events if all users estimated (other user is excluded)', async () => {
  const {
    roomId,
    storyId,
    userIdOne: userId,
    userIdTwo,
    processor,
    mockStore
  } = await prepTwoUsersInOneRoomWithOneStory();

  mockStore.manipulate((room) => {
    room.users[userIdTwo].excluded = true;
    return room;
  });

  const commandId = uuid();
  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: 2
      }
    },
    userId
  ).then(({producedEvents}) =>
    expect(producedEvents).toMatchEvents(
      commandId,
      roomId,
      'storyEstimateGiven',
      'revealed',
      'consensusAchieved'
    )
  );
});

test('Should produce additional "revealed" and "consensusAchieved" events if all users estimated (other user is disconnected)', async () => {
  const {
    roomId,
    storyId,
    userIdOne: userId,
    userIdTwo,
    processor,
    mockStore
  } = await prepTwoUsersInOneRoomWithOneStory();

  mockStore.manipulate((room) => {
    room.users[userIdTwo].disconnected = true;
    return room;
  });

  const commandId = uuid();
  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: 2
      }
    },
    userId
  ).then(({producedEvents}) =>
    expect(producedEvents).toMatchEvents(
      commandId,
      roomId,
      'storyEstimateGiven',
      'revealed',
      'consensusAchieved'
    )
  );
});

describe('preconditions', () => {
  test('Should throw if storyId does not match "selectedStory"', async () => {
    const {
      roomId,
      userIdOne: userId,
      processor,
      mockStore
    } = await prepTwoUsersInOneRoomWithOneStory();

    const secondStoryId = uuid();

    mockStore.manipulate((room) => {
      room.stories[secondStoryId] = {
        id: secondStoryId,
        title: 'second story'
      };

      return room;
    });

    return expect(
      processor(
        {
          id: uuid(),
          roomId: roomId,
          name: 'giveStoryEstimate',
          payload: {
            storyId: secondStoryId,
            value: 2
          }
        },
        userId
      )
    ).rejects.toThrow(
      /Precondition Error during "giveStoryEstimate": Can only give estimation for currently selected story/
    );
  });

  test('Should throw if story already revealed', async () => {
    const {
      roomId,
      storyId,
      userIdOne: userId,
      processor,
      mockStore
    } = await prepTwoUsersInOneRoomWithOneStory();

    mockStore.manipulate((room) => {
      room.stories[storyId].revealed = true;
      return room;
    });

    return expect(
      processor(
        {
          id: uuid(),
          roomId: roomId,
          name: 'giveStoryEstimate',
          payload: {
            storyId: storyId,
            value: 2
          }
        },
        userId
      )
    ).rejects.toThrow('You cannot give an estimate for a story that was revealed!');
  });

  test('Should throw if user is marked as excluded', async () => {
    const {
      roomId,
      storyId,
      userIdOne: userId,
      processor,
      mockStore
    } = await prepTwoUsersInOneRoomWithOneStory();

    mockStore.manipulate((room) => {
      room.users[userId].excluded = true;
      return room;
    });

    return expect(
      processor(
        {
          id: uuid(),
          roomId: roomId,
          name: 'giveStoryEstimate',
          payload: {
            storyId: storyId,
            value: 2
          }
        },
        userId
      )
    ).rejects.toThrow('Users that are excluded from estimations cannot give estimations!');
  });
});
