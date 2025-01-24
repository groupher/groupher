describe('help changelog page: ', () => {
  before(() => {
    cy.visit('/home/changelog')
  })

  it('basic layout should be visible', () => {
    cy.id('header-notify-icon').should('be.visible')
    cy.id('community-digest').should('be.visible')
    // cy.id('community-content').should('be.visible')

    // cy.id('footer').to.have.text('Groupher')
    //  .should('be.visible')
  })
})
