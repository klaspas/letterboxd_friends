
const sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const getHTML = function (url) {
    return fetch(url).then(result => { return result.text(); });
};


const getinfo = async () => {
    // Gets Username and movie from the current site
    const main_nav = $('.main-nav').html();
    if (typeof main_nav === 'undefined') {
        await sleep(100);
        const user_movie = getinfo();
        return user_movie;
    }
    else {
        const movie_link = $('meta[property="og:url"]').attr('content');
        url_part = movie_link.split('film/')[1].split('/')[1];
        const exclude = ['members', 'likes', 'reviews', 'ratings', 'fans', 'lists'];
        if (!exclude.includes(url_part)) {
            const movie = movie_link.match('(?<=film\/)(.*?)(?=\/)')[0];
            const user_link = $('a:contains("Profile")').parent().html();
            const user = $(user_link).attr('href');
            if (typeof user !== 'undefined') {
                return [user, movie];
            }
        }
        return null;
    }
};

const getContent = async (url, user_movie) => {
    const rating_list = [];
    let person_count = 0;
    let like_count = 0;
    while (true) {
        if (url !== 'undefined') {
            const html = getHTML(url);
            table = await html.then(function (html) {
                const tbody = $(html).find('tbody').html();
                if (typeof tbody !== 'undefined') {
                    const table = '<tbody>' + tbody + '</tbody>';
                    $(table).find('tr').each(function () {
                        person = $(this).find(".name").attr('href');
                        if (person !== user_movie[0]) {
                            rating = $(this).find(".rating").attr('class');
                            person_count += 1;
                            const like = $(this).find('.icon-liked').html();
                            if (typeof like !== 'undefined') {
                                like_count += 1;
                            }
                            if (typeof rating !== 'undefined') {
                                const ratingMatch = rating.match(/rated-(\d+)/);
                                if (ratingMatch) {
                                    rating_list.push(Number(ratingMatch[1]));
                                }
                            }
                        }
                    });

                }
                const next_page_loc = $(html).find('.next').parent().html();
                const next_page = $(next_page_loc).attr('href');
                return [next_page, rating_list, person_count, like_count];

            });
            if (typeof table[0] === 'undefined') {
                if (table[1].length == 0 & table[3] == 0)
                    break;
                else {
                    prepContent(table, user_movie);
                    return true;
                }
            }
            else {
                url = 'https://letterboxd.com' + table[0];
            }
        }


    }
};

const prepContent = function (table, user_movie) {
    rating_list = table[1];
    votes = rating_list.length;
    console.log('Ratings:', rating_list);
    console.log('Person Count:', table[2]);
    console.log('Like Count:', table[3]);
    if (votes == 0) {
        avg_1 = '–.–';
        avg_2 = '–.–';
    }
    else {
        let sum = 0;
        for (const r of rating_list) {
            sum += r;
        }
        avg = sum / (votes * 2);
        avg_1 = avg.toFixed(1);
        avg_2 = avg.toFixed(2);
    }

    console.log('Average Rating:', avg_1);
    href_head = user_movie[0] + 'friends/film/' + user_movie[1];
    href_likes = user_movie[0] + 'friends/film/' + user_movie[1] + '/likes/';
    if (votes == 1)
        rating = 'rating';
    else {
        rating = 'ratings';
    }
    data_popup = 'Average of ' + avg_2 + ' based on ' + votes + ' ' + rating;
    const rating_count = [];
    for (let i = 1; i < 11; i++) {
        count = 0;
        for (rating of rating_list) {
            if (rating == i) {
                count += 1;
            }
        }
        rating_count.push(count);
    }

    const max_rating = Math.max(...rating_count);
    const percent_rating = [];

    for (rating of rating_count) {
        const perc = Math.round((rating / votes) * 100);
        percent_rating.push(perc);
    }

    const rat = [];
    stars = ['half-★', '★', '★½', '★★', '★★½', '★★★', '★★★½', '★★★★', '★★★★½', '★★★★★'];
    for (let i = 1; i < 11; i++) {
        if (rating_count[i - 1] == 1)
            rating = 'rating';
        else {
            rating = 'ratings';
        }
        r_n = rating_count[i - 1] + ' ' + stars[i - 1] + ' ' + rating + ' ' + '(' + percent_rating[i - 1] + '%)';
        rat.push(r_n);
    };


    const starPath = 'M5.065.45c-.22-.61-.95-.59-1.14 0l-.75 2.57H.705c-.73 0-.96.62-.37 1.07l1.99 1.53-.76 2.49c-.22.73.34 1.16.93.71l2-1.53 2 1.53c.59.45 1.15.02.93-.71l-.76-2.49 1.99-1.53c.59-.45.39-1.07-.33-1.07h-2.48z';
    const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" role="graphics-symbol" class="glyph stars -start -rating" width="9" height="9" viewBox="0 0 9 9" aria-label="★"><title>★</title><path transform="translate(0,0)" fill-rule="evenodd" d="' + starPath + '"></path></svg>';
    const svgEnd = '<svg xmlns="http://www.w3.org/2000/svg" role="graphics-symbol" class="glyph stars -end -rating" width="49" height="9" viewBox="0 0 49 9" aria-label="★★★★★"><title>★★★★★</title>' + [0,10,20,30,40].map(x => '<path transform="translate(' + x + ',0)" fill-rule="evenodd" d="' + starPath + '"></path>').join('') + '</svg>';

    const likes_text = table[3] == 1 ? '1 like' : table[3] + ' likes';

    let bars_html = '';
    for (let i = 0; i < 10; i++) {
        const value = max_rating > 0 ? rating_count[i] / max_rating : 0;
        bars_html +=
            '<tr class="column" style="--value:' + value + ';">' +
            '<th scope="row" class="_sr-only">' + stars[i] + '</th>' +
            '<td class="cell">' +
            '<a href="' + href_head + '" id="a' + (i+1) + '" class="barcolumn tooltip" data-popup="' + rat[i].replace(/"/g, '&quot;') + '">' +
            '<span class="_sr-only">' + rat[i] + '</span>' +
            '<span class="bar"><span class="fill"></span></span>' +
            '</a>' +
            '</td>' +
            '</tr>';
    }

    const str =
        '<section class="section ratings-histogram-chart">' +
        '<header class="section-header -divider -spaced-loose">' +
        '<h2 class="section-heading -omitdivider heading"><a href="' + href_head + '">Your Friends</a></h2>' +
        '<aside class="aside"><div class="section-accessories">' +
        '<a href="' + href_likes + '" class="accessory">' + likes_text + '</a>' +
        '</div></aside>' +
        '</header>' +
        '<div class="rating-histogram"><div class="layout">' +
        svgStart +
        '<table class="chart"><caption class="_sr-only">Rating Distribution</caption>' +
        '<thead class="_sr-only"><tr><th scope="col">Rating</th><th scope="col">Count</th></tr></thead>' +
        '<tbody class="plot">' + bars_html + '</tbody></table>' +
        svgEnd +
        '<a href="' + href_head + '" id="a11" class="averagerating tooltip" data-popup="' + data_popup + '">' + avg_1 + '</a>' +
        '</div></div>' +
        '<div class="twipsy fade above in" id="popup1" style="display:none"><div id="popup2" class="twipsy-arrow" style="left:50%;"></div><div id="aad" class="twipsy-inner"></div></div>' +
        '</section>';

    html = $.parseHTML(str);
    injectContent(html);
    return true;
};

const injectContent = function (html) {

    path = $('.sidebar');
    $(html).appendTo(path);
    console.log('Injected');
    return true;
};

const getWidths = async () => {
    const widths = [];
    $('#popup1').attr('style', 'display: block; top: -3px; left: -10px;');
    for (let i = 1; i <= 11; i++) {
        const text = $('#a' + i).data('popup');
        $('#aad').text(text);
        widths.push(i === 11 ? $('#popup1').outerWidth() : $('#aad').width());
    }
    $('#popup1').attr('style', 'display: none');
    return widths;
};

const main = async () => {
    const user_movie = await getinfo();
    if (user_movie !== null && typeof user_movie !== 'undefined') {
        const user = user_movie[0];
        const movie = user_movie[1];
        const newURL = 'https://letterboxd.com' + user + 'friends/film/' + movie;
        chrome.runtime.sendMessage({ content: newURL });
        promise = await getContent(newURL, user_movie);
        widths = await getWidths();
        return widths;
    }
};





widths = main();

document.addEventListener('mousemove', function (e) {
    const element = $(e.target).closest('#a1,#a2,#a3,#a4,#a5,#a6,#a7,#a8,#a9,#a10,#a11');
    if (element.length) {
        const id = element.attr('id');
        const text = element.data('popup');
        if (id == 'a11') {
            const offsetParentLeft = $('#a1').offsetParent().offset().left;
            const a11Center = element.offset().left + element.outerWidth() / 2 - offsetParentLeft;
            var position = a11Center - Number(widths[10]) / 2;
            var arrow = 'left: 50%';
        } else {
            const li_nr = Number(id.replace('a', ''));
            var position = -(Number(widths[li_nr - 1]) / 2) + (li_nr * 16) - 7.5;
            var arrow = 'left: 50%';
        }
        $('#popup1').attr('style', 'display: block; top: -3px; left:' + position + 'px;');
        $('#popup2').attr('style', arrow);
        $('#aad').text(text);
    } else {
        $('#popup1').attr('style', 'display: none');
    }
}, false);
