const kb = require('./keyboard-buttons')

module.exports ={
    home: [
        [kb.home.films, kb.home.cinemas],
        [kb.home.favourite]
    ],
    films: [
        [kb.film.random],
        [kb.film.action, kb.film.comedy, kb.film.horror, kb.film.thriller, kb.film.scifi, kb.film.adventure],
        [kb.back]
    ],

    cinemas: [
        [
            {
                text: 'Send location',
                request_location: true
            }
        ],
        [kb.back]
    ]
}