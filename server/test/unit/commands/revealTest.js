import {v4 as uuid} from 'uuid';
import {prepOneUserInOneRoomWithOneStory} from '../testUtils';

test('Should produce revealed event', async () => {
  const {roomId, userId, storyId, processor} = await prepOneUserInOneRoomWithOneStory();

  const commandId = uuid();
  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'reveal',
      payload: {
        storyId: storyId
      }
    },
    userId
  ).then(({producedEvents, room}) => {
    expect(producedEvents).toMatchEvents(commandId, roomId, 'revealed');

    const [revealedEvent] = producedEvents;

    expect(revealedEvent.payload.storyId).toEqual(storyId);
    expect(revealedEvent.payload.manually).toBe(true);

    // flag set on story in room
    expect(room.stories[storyId].revealed).toBe(true);
  });
});

test('Users marked as excluded should still be able to reveal', async () => {
  const {roomId, userId, storyId, processor, mockStore} = await prepOneUserInOneRoomWithOneStory();

  mockStore.manipulate((room) => {
    room.users[userId].excluded = true;
    return room;
  });

  const commandId = uuid();
  return processor(
    {
      id: commandId,
      roomId: roomId,
      name: 'reveal',
      payload: {
        storyId: storyId
      }
    },
    userId
  ).then(({producedEvents}) => expect(producedEvents).toMatchEvents(commandId, roomId, 'revealed'));
});

describe('preconditions', () => {
  test('Should throw if storyId does not match currently selected story', async () => {
    const {roomId, userId, processor} = await prepOneUserInOneRoomWithOneStory();

    return expect(
      processor(
        {
          id: uuid(),
          roomId,
          name: 'reveal',
          payload: {
            storyId: 'anotherStory'
          }
        },
        userId
      )
    ).rejects.toThrow('Can only reveal currently selected story!');
  });

  test('Should throw if story is already revealed', async () => {
    const {
      roomId,
      userId,
      processor,
      storyId,
      mockStore
    } = await prepOneUserInOneRoomWithOneStory();

    mockStore.manipulate((room) => {
      room.stories[storyId].revealed = true;
      return room;
    });

    return expect(
      processor(
        {
          id: uuid(),
          roomId,
          name: 'reveal',
          payload: {
            storyId
          }
        },
        userId
      )
    ).rejects.toThrow('Story is already revealed');
  });
});
