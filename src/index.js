const TelegramBot = require('node-telegram-bot-api')
const mongoose = require('mongoose') // MongoDB
const geolib = require('geolib') // Location
const lodash = require('lodash') // Distance
const config = require('./config') // Token e MongoDB
const helper = require('./helper') // Help file
const kb = require('./keyboard-buttons') // Keyboard buttons
const keyboard = require('./keyboard') // Keyboard
const database = require('../database.json') // Database
helper.logStart()

//Database connection
mongoose.Promise = global.Promise
mongoose.connect(config.DB_URL, {
})
    .then (() => console.log('MongoDB connected'))
    .catch((err) => console.log(err))

// Richiesta dei modelli (tipi, required)
require ('./models/film.model')
require ('./models/cinema.model')
require ('./models/user.model')

const {cinemas, films} = require("./keyboard");
const querystring = require("querystring");

const Film = mongoose.model('films')
const Cinema = mongoose.model('cinemas')
const User = mongoose.model('users')

//database.films.forEach(f => new Film(f).save()) -- Popolamento MongoDB con film e cinema (serve una sola volta per popolare la raccolta con le informazioni)
//database.cinemas.forEach(c => new Cinema(c).save().catch(e => console.log(e))) -- Popolamento MongoDB con film e cinema (serve una sola volta per popolare la raccolta con le informazioni)

// Dichiarazione di ACTION_TYPE
const ACTION_TYPE = {
    TOGGLE_FAV_FILM: 'tff',
    SHOW_CINEMAS: 'sc',
    SHOW_CINEMAS_MAP: 'scm',
    SHOW_FILMS: 'sf'
}
// -----------------------------

// Richiesta del token del bot
const bot = new TelegramBot(config.TOKEN, {
    polling:true
})

//Keyboard
bot.on('message', msg => {
    console.log('Working', msg.from.first_name)
    
    const chatId = helper.getChatId(msg)
    switch (msg.text){
        case kb.home.favourite:
            showFavouriteFilms(chatId, msg.from.id)
            break

        case kb.home.films:
            bot.sendMessage(chatId, 'Choose the genre: ', {
                reply_markup: {keyboard: keyboard.films}
            })
            break
        case kb.film.action:
            sendFilmByQuery(chatId, {type: 'Action'})
            break
        case kb.film.comedy:
            sendFilmByQuery(chatId, {type: 'Comedy'})
            break
        case kb.film.horror:
            sendFilmByQuery(chatId, {type: 'Horror'})
            break
        case kb.film.thriller:
            sendFilmByQuery(chatId, {type: 'Thriller'})
            break
        case kb.film.scifi:
            sendFilmByQuery(chatId, {type: 'Sci-Fi'})
            break
        case kb.film.adventure:
            sendFilmByQuery(chatId, {type: 'Adventure'})
            break
        case kb.film.random:
            sendFilmByQuery(chatId, {})
            break
        case kb.home.cinemas:
            bot.sendMessage(chatId, 'Please, send your location.', {
                reply_markup:{
            keyboard: keyboard.cinemas
                }
            })
            break
        case kb.back:
            bot.sendMessage(chatId, 'What you would like to watch?', {
                reply_markup: {keyboard: keyboard.home}
            })
            break
    }

    if(msg.location) {
        getCinemasInCoords(chatId, msg.location)
    }
})

//Inizio del lavoro
bot.onText(/\/start/, msg => {
    const text = ("Hello, " + msg.from.first_name + "!" + "\nChoose a comand to start working:")
    bot.sendMessage(helper.getChatId(msg), text, {
        reply_markup: {
            keyboard: keyboard.home 
        }
    })
})

// ACTION_TYPE per comodita delle funzioni
bot.on('callback_query', query => {
    const userId = query.from.id
    let data
    try{

    } catch (e) {
        throw new Error('Data is not an object')
    }

    const { type } = data
    if (type === ACTION_TYPE.SHOW_CINEMAS_MAP){
        const {lat, lon} = data
        bot.sendLocation(query.message.chatId, lat, lon)
    } else if (type === ACTION_TYPE.SHOW_CINEMAS){
        sendCinemasByQuery(userId, {uuid: {'$in': data.cinemaUuids}})
    } else if (type === ACTION_TYPE.TOGGLE_FAV_FILM){
        toggleFavouriteFilm(userId, query.id, data)
    } else if (type === ACTION_TYPE.SHOW_FILMS){
        sendFilmByQuery(userId, {uuid: {'$in': data.filmUuids}})
    }
})

// Manda film e bottoni Favourites 
bot.onText(/\/f.(.+)/, (msg, [source, match]) => {
    const filmUuid = helper.getItemUuid(source)
    const chatId = helper.getChatId(msg)

    Promise.all([
        Film.findOne({uuid: filmUuid}),
        User.findOne({telegramId: msg.from.id})
    ]).then(([film, user]) => {

        let isFav = false

        if (user) {
            isFav = user.films.indexOf(film.uuid) !== -1
        }
        const favText = isFav ? 'Delete from favourites' : 'Add to favourites'

        const caption = `Title: ${film.name}\nYear: ${film.year}\nRating: ${film.rate}\nLength: ${film.length}\nCountry: ${film.country}`
        bot.sendPhoto(chatId, film.picture, {
            caption: caption,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Add to favourites',
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.TOGGLE_FAV_FILM,
                                filmUuid: film.uuid,
                                isFav: isFav
                            })

                        },
                        {
                            text: 'Show cinemas',
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_CINEMAS,
                                cinemaUuids: film.cinemas
                            })
                        }
                    ],
                    [
                        {
                            text: 'Go to IMDb',
                            url: film.link
                        }
                    ]

                ]
            }
        })
    })
})

// Bottoni di Cinema
bot.onText(/\/c(.+)/, (msg, [source, match])=>{
    const cinemaUuid = helper.getItemUuid(source)
    const chatId = helper.getChatId(msg)
    cinema.findOne({uuid: cinemaUuid}).then(cinema => {
        bot.sendMessage(chatId, `Cinema ${cinema.name}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: cinema.name,
                            url: cinema.url
                        },
                        {
                            text: 'Show map',
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_CINEMAS_MAP,
                                lat:cinema.location.latitude,
                                lon:cinema.location.longitude
                            })
                        }
                    ],
                    [
                        {
                            text: 'Show films',
                            callback_data: JSON.stringify({
                                type: ACTION_TYPE.SHOW_FILMS,
                                filmUuids: cinema.films
                            })
                        }
                    ]
                ]
            }
        })
    })
})
// -----------------------------

// Funzioni

// Manipolazione con dati in collection films
function sendFilmByQuery(chatId, query) {
    Film.find(query).then(films =>{
        const html = films.map((f, i) => {
            return `<b>${i + 1}</b> ${f.name} - /f${f.uuid}`
        }).join('\n')

        sendHTML(chatId, html, 'films')

    })
}

function sendHTML(chatId, html, kbName = null) {
    const options = {
        parse_mode: 'HTML'
    }

    if(kbName) {
        options['reply_markup'] = {
            keyboard: keyboard[kbName]
        }
    }

    bot.sendMessage(chatId, html, options)
}

// Manipolazione con distanza di cinema
function getCinemasInCoords(chatId, location) {
    Cinema.find({}).then(cinemas => {
        cinemas.forEach(c =>{
            c.distance = geolib.getDistance(location, c.location) / 1000
        })
        cinemas = lodash.sortBy(cinemas, 'distance')

        const html = cinemas.map((c, i) => {
            return `<b>${i + 1}</b> ${c.name}. <em>Distance</em> - <strong>${c.distance}</strong> km. /c${c.uuid}`
        }).join('\n')
        sendHTML(chatId, html, 'home')
    })
}

// Manipolazione con favourites
function toggleFavouriteFilm(userId, queryId, {filmUuid, isFav}) {
    let userPromise

    User.findOne({telegramId: userId})
        .then(user => {
            if (user) {
                if (isFav) {
                    user.films = user.films.filter(fUuid => fUuid !== filmUuid)
                } else {
                    user.films.push(filmUuid)
                }
                userPromise = user
            } else {
                userPromise = new User({
                    telegramId: userId,
                    films: [filmUuid]
                })
            }
        })

    const answerText = isFav ? 'Deleted' : 'Added'
    userPromise.save().then(_ => {
        bot.answerCallbackQuery(queryId, { text: answerText })
    }).catch(err => console.log(err))

}

// Visualizzazione dei favoriti
function showFavouriteFilms(chatId, telegramId) {
    User.findOne({telegramId})
        .then(user => {
            if (user) {
            Film.find({uuid: {'$in' : user.films}}).then(films => {
                let html

                if (films.length) {
                html = films.map((f, i) => {
                    return `<b>${i+1}</b> ${f.name} - <b>${f.rate}</b> (/f${f.uuid}`
                    })
                } else {
                    html = 'No films'
                }

                sendHTML(chatId, html, 'home')
            })
            } else {
                sendHTML(chatId, 'No films in favourites', 'home')
            }
        })
}

// Manipolazione con dati in collection cinemas
function sendCinemasByQuery(userId, query) {
    Cinema.find(query).then(cinemas => {
        const html = cinemas.map((c, i) =>{
            return `<b>${i + 1} </b> ${c.name} - /c${c.uuid}`
        }).join('\n')
        sendHTML(userId, html, 'home')
    })
}




