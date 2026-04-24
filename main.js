const sleep = (ms) =>{
    return new Promise(resolve => setTimeout(resolve, ms));
};

const getHTML = (url) => {
    return fetch(url).then(result => {
        if (!result.ok) throw new Error(`HTTP ${result.status} fetching ${url}`);
        return result.text();
    });
};

const notloggedIn = () => {
    console.log("Friends Average for Letterboxd extension info:\nThis extension only works if the user is logged in!")
};

const getUserandMovie = async (retries = 5) => {
    // Gets Username and movie from the current site
    const mainNavHTML = $('.main-nav').html();
    if (typeof mainNavHTML == 'undefined') {
        if (retries <= 0) return null;
        await sleep(100);
        return getUserandMovie(retries - 1);
    }

    const movieLink = $('meta[property="og:url"]').attr('content');
    if (!movieLink) return null;

    const urlParts = movieLink.split('film/');
    if (urlParts.length < 2) return null;

    const urlSubParts = urlParts[1].split('/');
    const urlPart = urlSubParts[1];
    const exclude = ['members', 'likes', 'reviews', 'ratings', 'fans', 'lists'];
    if (exclude.includes(urlPart)) return null;

    const movie = movieLink.match('(?<=film\/)(.*?)(?=\/)')[0];
    const userLink = $('a:contains("Profile")').parent().html();
    const user = $(userLink).attr('href');
    if (!user) return null;

    return [user, movie];
};

const parseHistogram = (histogramHtml) => {
    const $html = $($.parseHTML(histogramHtml.trim()));
    const ratingCount = [];

    $html.find('tr.column').each(function () {
        const title = $(this).find('a.barcolumn, span.barcolumn').attr('title') || '';
        const match = title.match(/^(\d+)/);
        ratingCount.push(match ? Number(match[1]) : 0);
    });

    const avgTitle = $html.find('a.averagerating').attr('title') || '';
    const avgMatch = avgTitle.match(/Average of ([\d.]+) based on (\d+)/);
    const avg = avgMatch ? Number(avgMatch[1]) : null;
    const votes = avgMatch ? Number(avgMatch[2]) : ratingCount.reduce((a, b) => a + b, 0);

    return { ratingCount, avg, votes };
};

const fetchRatingsData = async (user, movie) => {
    const ratingsUrl = `https://letterboxd.com${user}friends/film/${movie}/`;
    const histogramUrl = `https://letterboxd.com/csi${user}friends/film/${movie}/histogram/`;

    const [ratingsHtml, histogramHtml] = await Promise.all([
        getHTML(ratingsUrl),
        getHTML(histogramUrl)
    ]);

    const likesTitle = $(ratingsHtml).find('.js-route-likes a.tooltip').attr('title') || '';
    const likesMatch = likesTitle.match(/(\d+)/);
    const likeCount = likesMatch ? Number(likesMatch[1]) : 0;

    const { ratingCount, avg, votes } = parseHistogram(histogramHtml);

    if (votes === 0 && likeCount === 0) {
        console.log("Friends Average for Letterboxd extension info:\nNo ratings and likes from your friends for this film, so nothing to show.");
        return null;
    }
    return { ratingCount, avg, votes, likeCount };
};

const getRelativeAndPercentRatings = (ratingCounts, votes) => {
    const maxRating = Math.max(...ratingCounts);
    const relative = ratingCounts.map(count => {
        let height = (count / maxRating) * 44.0;
        return (height < 1 || !isFinite(height)) ? 1 : height;
    });
    const percent = ratingCounts.map(count =>
        votes > 0 ? Math.round((count / votes) * 100) : 0
    );
    return [ relative, percent ];
};

const formatRatingLabels = (ratingCounts, percentRatings) => {
    const stars = ['half-★', '★', '★½', '★★', '★★½','★★★', '★★★½', '★★★★', '★★★★½', '★★★★★'];
    return ratingCounts.map((count, i) => {
        const label = count === 1 ? 'rating' : 'ratings';
        return `${count} ${stars[i]} ${label} (${percentRatings[i]}%)`;
    });
};

const buildHTMLStructure = (hrefHead, hrefLikes, likesText, avg1, dataPopup, ratingCounts, ratingLabels, maxRating) => {
    const stars = ['half-★', '★', '★½', '★★', '★★½', '★★★', '★★★½', '★★★★', '★★★★½', '★★★★★'];
    const starPath = 'M5.065.45c-.22-.61-.95-.59-1.14 0l-.75 2.57H.705c-.73 0-.96.62-.37 1.07l1.99 1.53-.76 2.49c-.22.73.34 1.16.93.71l2-1.53 2 1.53c.59.45 1.15.02.93-.71l-.76-2.49 1.99-1.53c.59-.45.39-1.07-.33-1.07h-2.48z';
    const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" role="graphics-symbol" class="glyph stars -start -rating" width="9" height="9" viewBox="0 0 9 9" aria-label="★"><title>★</title><path transform="translate(0,0)" fill-rule="evenodd" d="' + starPath + '"></path></svg>';
    const svgEnd = '<svg xmlns="http://www.w3.org/2000/svg" role="graphics-symbol" class="glyph stars -end -rating" width="49" height="9" viewBox="0 0 49 9" aria-label="★★★★★"><title>★★★★★</title>' + [0,10,20,30,40].map(x => '<path transform="translate(' + x + ',0)" fill-rule="evenodd" d="' + starPath + '"></path>').join('') + '</svg>';

    let barsHtml = '';
    for (let i = 0; i < 10; i++) {
        const value = maxRating > 0 ? ratingCounts[i] / maxRating : 0;
        barsHtml +=
            '<tr class="column" style="--value:' + value + ';">' +
            '<th scope="row" class="_sr-only">' + stars[i] + '</th>' +
            '<td class="cell">' +
            '<a href="' + hrefHead + '" id="a' + (i+1) + '" class="barcolumn tooltip" data-popup="' + ratingLabels[i].replace(/"/g, '&quot;') + '">' +
            '<span class="_sr-only">' + ratingLabels[i] + '</span>' +
            '<span class="bar"><span class="fill"></span></span>' +
            '</a>' +
            '</td>' +
            '</tr>';
    }

    const str =
        '<section class="section ratings-histogram-chart">' +
        '<header class="section-header -divider -spaced-loose">' +
        '<h2 class="section-heading -omitdivider heading"><a href="' + hrefHead + '">Your Friends</a></h2>' +
        '<aside class="aside"><div class="section-accessories">' +
        '<a href="' + hrefLikes + '" class="accessory">' + likesText + '</a>' +
        '</div></aside>' +
        '</header>' +
        '<div class="rating-histogram"><div class="layout">' +
        svgStart +
        '<table class="chart"><caption class="_sr-only">Rating Distribution</caption>' +
        '<thead class="_sr-only"><tr><th scope="col">Rating</th><th scope="col">Count</th></tr></thead>' +
        '<tbody class="plot">' + barsHtml + '</tbody></table>' +
        svgEnd +
        '<a href="' + hrefHead + '" id="a11" class="averagerating tooltip" data-popup="' + dataPopup + '">' + avg1 + '</a>' +
        '</div></div>' +
        '<div class="twipsy fade above in" id="popup1" style="display:none"><div id="popup2" class="twipsy-arrow" style="left:50%;"></div><div id="aad" class="twipsy-inner"></div></div>' +
        '</section>';

    return $.parseHTML(str);
};
const prepareHTML = ({ ratingCount, avg, votes, likeCount }, user, movie) => {
    const [ , percentRatings ] = getRelativeAndPercentRatings(ratingCount, votes);
    const ratingLabels = formatRatingLabels(ratingCount, percentRatings);

    if (debug) {
        console.log('Rating counts:', ratingCount);
        console.log('Votes Count:', votes);
        console.log('Like Count:', likeCount);
        console.log('Average Rating:', avg ? avg.toFixed(3) : null);
    }

    const avg1 = avg ? avg.toFixed(1) : '–.–';
    const avg2 = avg ? avg.toFixed(2) : '–.–';

    const hrefHead = `https://letterboxd.com${user}friends/film/${movie}`;
    const hrefLikes = `${hrefHead}/likes/`;
    const dataPopup = `Average of ${avg2} based on ${votes} ${votes === 1 ? 'rating' : 'ratings'}`;
    const likesText = `${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`;
    const maxRating = Math.max(...ratingCount);

    return buildHTMLStructure(hrefHead, hrefLikes, likesText, avg1, dataPopup, ratingCount, ratingLabels, maxRating);
};

// const xxx = (table, user, movie) => {
//     const rating_list = table[0];
//     const votes = rating_list.length;
//     const likeCount = table[2]


//     if (votes == 0) {
//         avg_1 = '–.–';
//         avg_2 = '–.–';
//     }
//     else {
//         let sum = 0;
//         for (let r of rating_list) {
//             sum += r;
//         }
//         avg = sum / (votes * 2);
//         avg_1 = avg.toFixed(1);
//         avg_2 = avg.toFixed(2);
//     }
//     if (debug) {
//         console.log('Ratings:', rating_list);
//         console.log('Person Count:', table[1]);
//         console.log('Like Count:', likeCount);
//         console.log('Average Rating:', avg);
//     }
    
//     href_head = user + 'friends/film/' + movie;
//     href_likes = user + 'friends/film/' + movie + '/likes/';
//     if (votes == 1)
//         rating = 'rating';
//     else {
//         rating = 'ratings';
//     }
//     data_popup = 'Average of ' + avg_2 + ' based on ' + votes + ' ' + rating;
//     let rating_count = [];
//     for (let i = 1; i < 11; i++) {
//         count = 0
//         for (rating of rating_list) {
//             if (rating == i) {
//                 count += 1;
//             }
//         }
//         rating_count.push(count);
//     }

//     const max_rating = Math.max(...rating_count);
//     let relative_rating = [];
//     let percent_rating = [];

//     for (rating of rating_count) {
//         let hight = (rating / max_rating) * 44.0;
//         if (hight < 1 || hight == Number.POSITIVE_INFINITY || isNaN(hight)) {
//             hight = 1;
//         }
//         relative_rating.push(hight);
//         const perc = Math.round((rating / votes) * 100);
//         percent_rating.push(perc);
//     }

//     let rat = [];
//     stars = ['half-★', '★', '★½', '★★', '★★½', '★★★', '★★★½', '★★★★', '★★★★½', '★★★★★'];
//     for (let i = 1; i < 11; i++) {
//         if (rating_count[i - 1] == 1)
//             rating = 'rating';
//         else {
//             rating = 'ratings';
//         }
//         r_n = rating_count[i - 1] + ' ' + stars[i - 1] + ' ' + rating + ' ' + '(' + percent_rating[i - 1] + '%)';
//         rat.push(r_n);
//     };


//     str1 = '<section class="section ratings-histogram-chart"><h2 class="section-heading"><a href="" id="aaa" title="">Your Friends</a></h2><a href="" id="aab" class="all-link more-link"></a><span class="average-rating" itemprop="aggregateRating" itemscope="" itemtype="http://schema.org/AggregateRating"><a href="" id="a11" class="tooltip display-rating -highlight" data-popup =""></a></span><div class="rating-histogram clear rating-histogram-exploded">        <span class="rating-green rating-green-tiny rating-1">            <span class="rating rated-2">★</span>        </span>        <ul>';
//     str2 = '<li id="li1" class="rating-histogram-bar" style="width: 15px; left: 0px"> <a href="" id="a1" class="ir tooltip"</a> </li><li id="li2" class="rating-histogram-bar" style="width: 15px; left: 16px"><a href="" id="a2" class="ir tooltip"></a></li><li id="li3" class="rating-histogram-bar" style="width: 15px; left: 32px"><a href="" id="a3" class="ir tooltip"></a></li><li id="li4" class="rating-histogram-bar" style="width: 15px; left: 48px"><a href="" id="a4" class="ir tooltip"></a></li><li id="li5" class="rating-histogram-bar" style="width: 15px; left: 64px"><a href="" id="a5" class="ir tooltip"></a></li><li id="li6" class="rating-histogram-bar" style="width: 15px; left: 80px"><a href="" id="a6" class="ir tooltip"></a></li><li id="li7" class="rating-histogram-bar" style="width: 15px; left: 96px"><a href="" id="a7" class="ir tooltip"></a></li><li id="li8" class="rating-histogram-bar" style="width: 15px; left: 112px"><a href="" id="a8" class="ir tooltip"></a></li><li id="li9" class="rating-histogram-bar" style="width: 15px; left: 128px"><a href="" id="a9" class="ir tooltip"></a></li><li id="li10" class="rating-histogram-bar" style="width: 15px; left: 144px"><a href="" id="a10" class="ir tooltip"></a></li></ul><span class="rating-green rating-green-tiny rating-5"><span class="rating rated-10">★★★★★</span></span></div>';
//     str3 = '<div class="twipsy fade above in" id="popup1", style="display: none"> <div id="popup2" class="twipsy-arrow" style="left: 50%;"></div> <div id = "aad" class="twipsy-inner"></div> </div> </section>';
//     str = str1 + str2 + str3;

//     html = $.parseHTML(str)
//     $(html).find('#aaa').attr('href', href_head);
//     $(html).find('#aab').attr('href', href_likes);
//     if (likeCount == 1) {
//         $(html).find('#aab').text('1 like');
//     }
//     else {
//         $(html).find('#aab').text(likeCount + ' likes');
//     }
//     $(html).find('#a11').attr('href', href_head);
//     $(html).find('#a11').attr('data-popup', data_popup);
//     $(html).find('#a11').text(avg_1);

//     for (let i = 1; i < 11; i++) {
//         const id = '#a' + i
//         const i_str = '<i id = "i' + i + '" style=" height: ' + relative_rating[i - 1] + 'px;"></i>'
//         $(html).find(id).attr('href', href_head);
//         $(html).find(id).text(rat[i - 1]);
//         $(html).find(id).append($.parseHTML(i_str));
//     }
//     return html;
// };

const injectHTML = (html) => {
    const path = $('.sidebar');
    $(html).appendTo(path);
};

const getWidths = async () => {
    const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'];
    const widthList = [];
    const popup = $('#popup1');
    const aad = $('#aad');

    popup.css({display: 'block', top: '-3px', left: '-10px'});

    for (const id of ids) {
        const text = $(`#${id}`).data('popup');
        aad.text(text);
        widthList.push(aad.width());
    }

    const extraText = $('#a11').data('popup');
    aad.text(extraText);
    widthList.push(popup.outerWidth());

    popup.css('display', 'none');
    return widthList
};

const main = async () => {
    const userMovie = await getUserandMovie();
    if (!userMovie) {
        notloggedIn();
        return;
    };
    [user, movie] = userMovie;
    chrome.runtime.sendMessage({ content: `https://letterboxd.com${user}friends/film/${movie}/ratings/` });
    const data = await fetchRatingsData(user, movie);
    if (!data) return;
    const html = prepareHTML(data, user, movie);
    injectHTML(html);
    const widths = await getWidths();
    return widths
};

let barWidths = null;
var debug = true;
(
    async () => {
    barWidths = await main();
    }
)();

document.addEventListener(
    'mousemove', (e) => {
        if (!barWidths) return;

        const element = $(e.target).closest('#a1,#a2,#a3,#a4,#a5,#a6,#a7,#a8,#a9,#a10,#a11');
        if (!element.length) {
            $('#popup1').attr('style', 'display: none');
            return;
        }

        const id = element.attr('id');
        const text = element.data('popup');
        let position;
        let arrow;

        if (id === 'a11') {
            const offsetParentLeft = $('#a1').offsetParent().offset().left;
            const a11Center = element.offset().left + element.outerWidth() / 2 - offsetParentLeft;
            position = a11Center - Number(barWidths[10]) / 2;
            arrow = 'left: 50%';
        } else {
            const liNr = Number(id.replace('a', ''));
            position = -(Number(barWidths[liNr - 1]) / 2) + (liNr * 16) - 7.5;
            arrow = 'left: 50%';
        }

        $('#popup1').attr('style', 'display: block; top: -3px; left:' + position + 'px;');
        $('#popup2').attr('style', arrow);
        $('#aad').text(text);
    }, false
);