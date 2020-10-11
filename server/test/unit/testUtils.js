import {v4 as uuid} from 'uuid';
import Promise from 'bluebird';

// we want to test with our real command- and event handlers.
import commandHandlers, {baseCommandSchema} from '../../src/commandHandlers/commandHandlers';
import eventHandlers from '../../src/eventHandlers/eventHandlers';
import commandProcessorFactory from '../../src/commandProcessor';

export const EXPECT_UUID_MATCHING = expect.stringMatching(
  new RegExp(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)
);

export function textToCsvDataUrl(csvContent) {
  const base64data = Buffer.from(csvContent).toString('base64');
  return 'data:text/csv;base64,' + base64data;
}

/**
 * our mock store contains only one room.
 * commandProcessor will load this room (if set), and store back manipulated room.
 *
 * room object can be manually manipulated to prepare for different scenarios.
 *
 * @param {object} [initialRoom] If not set, room will not exists in store.
 */
export function newMockStore(initialRoom) {
  let room = initialRoom ? detatchObject(initialRoom) : undefined;

  return {
    getRoomById: (id) => {
      if (!room || room.id !== id) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(detatchObject(room));
    },
    saveRoom: (rm) => {
      room = detatchObject(rm);
      return Promise.resolve();
    },
    getAllRooms: () => {
      if (!room) {
        return Promise.resolve({});
      }

      return Promise.resolve({
        [room.id]: detatchObject(room)
      });
    },
    manipulate: (fn) => {
      const modifiedRoom = fn(room);
      if (!modifiedRoom) {
        throw new Error('Your function in "manipulate" must return the room!');
      }
      room = modifiedRoom;
    },
    getStoreType: () => 'MockStore for unit tests'
  };
}

const detatchObject = (obj) => JSON.parse(JSON.stringify(obj));

export function prepEmpty() {
  const mockStore = newMockStore();
  const processor = commandProcessorFactory(
    commandHandlers,
    baseCommandSchema,
    eventHandlers,
    mockStore
  );
  return {mockStore, processor};
}

/**
 * create mock room store with one user in one room
 */
export async function prepOneUserInOneRoom(username = 'firstUser') {
  const {mockStore, processor} = prepEmpty();

  const roomId = uuid();
  const userId = uuid();
  await processor(
    {
      id: uuid(),
      roomId,
      name: 'joinRoom',
      payload: {
        username
      }
    },
    userId
  );

  return {userId, roomId, processor, mockStore};
}

export async function prepOneUserInOneRoomWithOneStory(username = 'firstUser') {
  const {userId, roomId, processor, mockStore} = await prepOneUserInOneRoom(username);

  const {producedEvents: adEvents} = await processor(
    {
      id: uuid(),
      roomId: roomId,
      name: 'addStory',
      payload: {
        title: 'the title',
        description: 'This will be awesome'
      }
    },
    userId
  );
  const storyId = adEvents[0].payload.id;

  return {userId, storyId, roomId, processor, mockStore};
}

export async function prepTwoUsersInOneRoomWithOneStoryAndEstimate(
  username,
  storyTitle,
  estimationValue = 8
) {
  const {
    userIdOne,
    userIdTwo,
    roomId,
    storyId,
    processor,
    mockStore
  } = await prepTwoUsersInOneRoomWithOneStory(username, storyTitle);

  await processor(
    {
      id: uuid(),
      roomId: roomId,
      name: 'giveStoryEstimate',
      payload: {
        storyId: storyId,
        value: estimationValue
      }
    },
    userIdOne
  );

  return {userIdOne, userIdTwo, roomId, storyId, processor, mockStore};
}

/**
 * create mock room store with two users in one room, a story already added (via cmd)
 */
export async function prepTwoUsersInOneRoomWithOneStory(
  username = 'firstUser',
  storyTitle = 'new super story'
) {
  const {mockStore, processor} = prepEmpty();

  const roomId = uuid();
  const userIdOne = uuid();
  const userIdTwo = uuid();
  await processor(
    {
      id: uuid(),
      roomId,
      name: 'joinRoom',
      payload: {
        username
      }
    },
    userIdOne
  );

  await processor(
    {
      id: uuid(),
      roomId,
      name: 'joinRoom',
      payload: {
        username: 'secondUser'
      }
    },
    userIdTwo
  );

  const {producedEvents: adEvents} = await processor(
    {
      id: uuid(),
      roomId,
      name: 'addStory',
      payload: {
        title: storyTitle,
        description: 'This will be awesome'
      }
    },
    userIdOne
  );
  const storyId = adEvents[0].payload.id;

  return {userIdOne, userIdTwo, roomId, storyId, processor, mockStore};
}
