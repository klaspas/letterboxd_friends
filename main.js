const sleep = (ms) =>{
    return new Promise(resolve => setTimeout(resolve, ms));
};

const getHTML = (url) => {
    return fetch(url).then(result => { return result.text() })
};

const getNextPageUrl = (html) => {
    return html.find('.next').closest('a').attr('href') || null;
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

const getRatingsPage = async (url, selfUser, movie) => {
    const ratingList = [];
    let personCount = 0
    let likeCount = 0;

    while (url && url !== 'undefined') {

        const html = await getHTML(url);

        const tbody = $(html).find('tbody').html();
        if (!tbody) return;

        const rows = extractTableRows($(html));

        for (const row of rows) {
            const result = extractRatings(row, selfUser);
            if (!result) continue

            const [ rating, liked ] = result;
            personCount++;
            if (rating) ratingList.push(rating);
            if (liked) likeCount++;
        }

        const nextPage = getNextPageUrl($(html))
        if (!nextPage) {
            if (ratingList.length === 0 && likeCount === 0) {
                console.log("Friends Average for Letterboxd extension info:\nNo ratings and likes from your friends for this film, so nothing to show.")
                return
            };
            return [ ratingList, personCount, likeCount ]
        }
        url = `https://letterboxd.com${nextPage}`;


    }
};

const extractRatings = ($row, currentUser) => {
    const person = $row.find('.name').attr('href');
    let rating = null;
    if (person === currentUser) return null;

    const liked = $row.find('.icon-liked').length > 0;

    const ratingClass = $row.find('.rating').attr('class') || '';
    const ratingMatch = ratingClass.match(/rated-(\d+)/); // finds string 'rated-' with one or more digits
    if (ratingMatch) {
        rating = Number(ratingMatch[1])
    }

    return [ rating, liked ];
};

const extractTableRows = ($html) => {
    const tbody = $html.find('tbody').html();
    if (!tbody) return [];

    const rowsTable = $('<tbody>' + tbody + '</tbody>');
    const rows = [];

    rowsTable.find('tr').each(function () {
        rows.push($(this));
    });
    return rows;
};

const calculateAverages = (ratingList) => {
    const votes = ratingList.length;
    if (votes === 0) {
        return [ None , votes ];
    }
    const sum = ratingList.reduce((acc, r) => acc + r, 0);
    const avg = sum / (votes * 2);
    return [ avg, votes ];
};

const getRatingCounts = (ratingList) => {
    const counts = Array(10).fill(0); // start with [0,0,...,0]
    for (const r of ratingList) {
        counts[r - 1]++; // rating 1 goes to index 0
    }
    return counts;
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

const buildHTMLStructure = () => {
    const str1 = `<section class="section ratings-histogram-chart">
        <h2 class="section-heading"><a href="" id="aaa" title="">Your Friends</a></h2>
        <a href="" id="aab" class="all-link more-link"></a>
        <span class="average-rating" itemprop="aggregateRating" itemscope="" itemtype="http://schema.org/AggregateRating">
            <a href="" id="a11" class="tooltip display-rating -highlight" data-popup=""></a>
        </span>
        <div class="rating-histogram clear rating-histogram-exploded">
            <span class="rating-green rating-green-tiny rating-1"><span class="rating rated-2">★</span></span>
            <ul>`;
    const str2 = Array.from({ length: 10 }, (_, i) =>
        `<li id="li${i+1}" class="rating-histogram-bar" style="width: 15px; left: ${i * 16}px">
            <a href="" id="a${i+1}" class="ir tooltip"></a>
        </li>`
    ).join('');
    const str3 = `</ul>
            <span class="rating-green rating-green-tiny rating-5"><span class="rating rated-10">★★★★★</span></span>
        </div>
        <div class="twipsy fade above in" id="popup1" style="display: none">
            <div id="popup2" class="twipsy-arrow" style="left: 50%;"></div>
            <div id="aad" class="twipsy-inner"></div>
        </div>
    </section>`;
    return $.parseHTML(str1 + str2 + str3);
};
//new
const prepareHTML = (table, user, movie) => {
    const ratingList = table[0];
    const likeCount = table[2];

    const [ avg, votes ] = calculateAverages(ratingList);
    const ratingCounts = getRatingCounts(ratingList);
    const [ relativeRatings, percentRatings ] = getRelativeAndPercentRatings(ratingCounts, votes);
    const ratingLabels = formatRatingLabels(ratingCounts, percentRatings);

    if (debug) {
        console.log('Ratings:', ratingList);
        console.log('Person Count:', table[1]);
        console.log('Votes Count:', votes);
        console.log('Like Count:', likeCount);
        console.log('Average Rating:', avg.toFixed(3));
    }

    const avg1 = avg ? avg.toFixed(1) : '–.–';
    const avg2 = avg ? avg.toFixed(2) : '–.–';

    const hrefHead = `${user}friends/film/${movie}`;
    const hrefLikes = `${hrefHead}/likes/`;
    const dataPopup = `Average of ${avg2} based on ${votes} ${votes === 1 ? 'rating' : 'ratings'}`;

    let html = buildHTMLStructure();

    $(html).find('#aaa').attr('href', hrefHead);
    $(html).find('#aab')
        .attr('href', hrefLikes)
        .text(`${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`);
    $(html).find('#a11')
        .attr('href', hrefHead)
        .attr('data-popup', dataPopup)
        .text(avg1);

    ratingLabels.forEach((label, i) => {
        const id = `#a${i+1}`;
        const heightStr = `<i id="i${i+1}" style="height: ${relativeRatings[i]}px;"></i>`;
        $(html).find(id)
            .attr('href', hrefHead)
            .text(label)
            .append($.parseHTML(heightStr));
    });

    return html;
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
        const text = $(`#${id}`).text();
        aad.text(text);
        widthList.push(aad.width())
    }

    const extraText = $('#a11').data('popup');
    aad.text(extraText);
    widthList.push(aad.width());

    popup.css('display', 'none');
    return widthList
};

const main = async () => {
    const userMovie = await getUserandMovie();
    if (!userMovie) {
        notloggedIn();
        return;
    };
    [user, movie] = userMovie
    const newURL = `https://letterboxd.com${user}friends/film/${movie}`;
    const results = await getRatingsPage(newURL, user);
    if (!results) return;
    const html = prepareHTML(results, user, movie);
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

        const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'];
        const element = e.target;
        const id = $(element).attr('id');
        const parentId = $(element).parent().attr('id');

        let targetId;
        if (ids.includes(id)) {
            targetId = id;
        } else if (ids.includes(parentId)) {
            targetId = parentId;
        } else {
            targetId = null;
        }

        if (!targetId) {
            $('#popup1').attr('style', 'display: none');
            return;
        }

        const liNr = Number(targetId.replace('a', ''));
        if (isNaN(liNr)) return;

        let text
        let position
        let arrow

        if (targetId == 'a11') {
            text = $(element).data('popup');
            position = - (Number(barWidths[10]) * 3 / 4) + 190;
            arrow = "left: 155px"
        }
        else {
            text = $(element).text() || $(element).parent().text();
            position = - (Number(barWidths[liNr - 1]) / 2) + (liNr * 16) - 7.5;
            arrow = "left: 50%";
        }

        $('#popup1').attr('style', 'display: block; top: -3px; left:' + position + 'px;')
        $('#popup2').attr('style', arrow)
        $('#aad').text(text);
    }, false
);