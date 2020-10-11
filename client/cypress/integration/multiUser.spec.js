import {v4 as uuid} from 'uuid';
import {tid} from '../support/commands';

beforeEach(function () {
  cy.fixture('users/default.json').then((data) => (this.user = data));
  cy.fixture('users/sergio.json').then((data) => (this.sergio = data));
  cy.fixture('stories.json').then((data) => (this.stories = data));
});

it('multi user estimation', function () {
  const roomId = 'multi-user-e2e_' + uuid();

  cy.visit('/' + roomId);

  cy.get(tid('usernameInput')).type(this.user.username);
  cy.get(tid('joinButton')).click();

  cy.get(tid('whoamiSimple'));

  // this will open an additional socket to the backend, so that we can add another user to the room
  // Cypress does not support multiple browsers!   see    https://docs.cypress.io/guides/references/trade-offs.html

  // see ../support/commands.js
  const userTwoSocket = uuid();
  const userTwoUserId = uuid();
  cy.openNewSocket(userTwoSocket);
  cy.sendCommands(userTwoSocket, [
    {
      roomId,
      userId: userTwoUserId,
      name: 'joinRoom',
      payload: {
        username: this.sergio.username,
        avatar: 3
      }
    }
  ]);

  // now we have two users in the room and can do a real estimation round :)

  cy.get(tid('storyAddForm') + ' input[type="text"]').type(this.stories[0].title);
  cy.get(tid('storyAddForm') + ' button').click();

  cy.get(tid('estimationCard.5')).click();
  // only we estimated.. nothing is revealed

  //  and I can change my mind..
  cy.get(tid('estimationCard.5')).click();

  cy.get(tid('estimationCard.13')).click();

  // several times ;)
  cy.get(tid('estimationCard.8')).click();

  // get the story id from the selected story node in the DOM
  cy.get(tid('storySelected'))
    .should('have.attr', 'id')
    .then((theStoryElementId) => {
      const storyId = theStoryElementId.substring(theStoryElementId.lastIndexOf('.') + 1);

      // let the other user estimate
      cy.sendCommands(userTwoSocket, [
        {
          roomId,
          userId: userTwoUserId,
          name: 'giveStoryEstimate',
          payload: {
            storyId,
            value: 3
          }
        }
      ]);
    });

  cy.get(tid('user')).contains('8');
  cy.get(tid('user')).contains('3');

  cy.get(tid('estimationArea', 'newRoundButton')); // revealed / round done -> "new Round" button is shown
});
