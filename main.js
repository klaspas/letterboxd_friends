const sleep = (ms) =>{
    return new Promise(resolve => setTimeout(resolve, ms));
};

const getHTML = (url) => {
    return fetch(url).then(result => {
        if (!result.ok) throw new Error(`HTTP ${result.status} fetching ${url}`);
        return result.text();
    });
};

const getMovie = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    console.log(parts);

    // must be exactly: ["film", "movie-name"] and nothing more
    if (parts.length !== 2 || parts[0] !== 'film') return null;

    return parts[1];
};

const getUser = () => {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('letterboxd.signed.in.as='));

    if (!match) return null;

    const user = decodeURIComponent(match.split('=')[1]);
    console.log(user)
    return user
}

const parseHistogram = (histogramHtml) => {
    const $html = $($.parseHTML(histogramHtml.trim()));
    const ratingCount = [];

    $html.find('tr.column').each(function () {
        const title = $(this).find('a.barcolumn, span.barcolumn').attr('title') || '';
        const match = title.match(/^(\d+)/);
        ratingCount.push(match ? Number(match[1]) : 0);
    });

    const votes = ratingCount.reduce((sum, n) => sum + n, 0);

    return { ratingCount, votes };
};

const parseLikes = (ratingsHtml) => {
    const likesTitle = $(ratingsHtml).find('.js-route-likes a.tooltip').attr('title') || '';
    const likesMatch = likesTitle.match(/(\d+)/);
    const likeCount = likesMatch ? Number(likesMatch[1]) : 0;
    return likeCount
};

const fetchRatingsData = async (user, movie) => {
    const ratingsUrl = `/${user}/friends/film/${movie}/`;
    const histogramUrl = `/csi/${user}/friends/film/${movie}/histogram/`;

    const [ratingsHtml, histogramHtml] = await Promise.all([
        getHTML(ratingsUrl),
        getHTML(histogramUrl)
    ]);

    const likeCount = parseLikes(ratingsHtml)
    const { ratingCount, votes } = parseHistogram(histogramHtml);

    if (votes === 0 && likeCount === 0 && debug) {
        console.log("No ratings and likes from your friends for this film, so nothing to show.");
        return null;
    }
    return { ratingCount, votes, likeCount };
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

const formatRating = (i) => {
    const rating = 0.5 + i * 0.5;

    if (rating % 1 === 0) return `${rating}`;
    if (rating === 0.5) return ".5";

    return `${Math.floor(rating)}%C2%BD`;
};

const buildHTMLStructure = (hrefHead, hrefLikes, likesText, avg1, dataPopup, ratingCounts, ratingLabels, maxRating) => {
    const stars = ['half-★', '★', '★½', '★★', '★★½', '★★★', '★★★½', '★★★★', '★★★★½', '★★★★★'];
    const starPath = 'M5.065.45c-.22-.61-.95-.59-1.14 0l-.75 2.57H.705c-.73 0-.96.62-.37 1.07l1.99 1.53-.76 2.49c-.22.73.34 1.16.93.71l2-1.53 2 1.53c.59.45 1.15.02.93-.71l-.76-2.49 1.99-1.53c.59-.45.39-1.07-.33-1.07h-2.48z';
    const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" role="graphics-symbol" class="glyph stars -start -rating" width="9" height="9" viewBox="0 0 9 9" aria-label="★"><title>★</title><path transform="translate(0,0)" fill-rule="evenodd" d="' + starPath + '"></path></svg>';
    const svgEnd = '<svg xmlns="http://www.w3.org/2000/svg" role="graphics-symbol" class="glyph stars -end -rating" width="49" height="9" viewBox="0 0 49 9" aria-label="★★★★★"><title>★★★★★</title>' + [0,10,20,30,40].map(x => '<path transform="translate(' + x + ',0)" fill-rule="evenodd" d="' + starPath + '"></path>').join('') + '</svg>';

    let barsHtml = '';
    for (let i = 0; i < 10; i++) {
        const value = maxRating > 0 ? ratingCounts[i] / maxRating : 0;
        const hrefBar = hrefHead + `/ratings/rated/${formatRating(i)}/by/date/`
        barsHtml +=
            '<tr class="column" style="--value:' + value + ';">' +
            '<th scope="row" class="_sr-only">' + stars[i] + '</th>' +
            '<td class="cell">' +
            '<a href="' + hrefBar + '" id="a' + (i+1) + '" class="barcolumn tooltip" data-popup="' + ratingLabels[i].replace(/"/g, '&quot;') + '">' +
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

const prepareHTML = ({ ratingCount, votes, likeCount }, user, movie) => {
    const [ , percentRatings ] = getRelativeAndPercentRatings(ratingCount, votes);
    const ratingLabels = formatRatingLabels(ratingCount, percentRatings);
    const avg =
        ratingCount.reduce((sum, count, i) => {
        const rating = 0.5 + i * 0.5;
        return sum + rating * count;
        }, 0) / votes;

    if (debug) {
        console.log('Rating counts:', ratingCount);
        console.log('Votes Count:', votes);
        console.log('Like Count:', likeCount);
        console.log('Average Rating:', avg ? avg.toFixed(4) : null);
    }

    const avg1 = avg ? avg.toFixed(1) : '–.–';
    const avg2 = avg ? avg.toFixed(2) : '–.–';

    const hrefHead = `/${user}/friends/film/${movie}`;
    const hrefLikes = `${hrefHead}/likes/`;
    const dataPopup = `Average of ${avg2} based on ${votes} ${votes === 1 ? 'rating' : 'ratings'}`;
    const likesText = `${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`;
    const maxRating = Math.max(...ratingCount);

    return buildHTMLStructure(hrefHead, hrefLikes, likesText, avg1, dataPopup, ratingCount, ratingLabels, maxRating);
};

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

    const user = getUser();
    if (!user) {
        console.log("Friends Average for Letterboxd extension info:\nThis extension only works if the user is logged in!");
        return;
    };
    
    const movie = getMovie();
    if (!movie) return;

    const data = await fetchRatingsData(user, movie);
    if (!data) return;
    
    const html = prepareHTML(data, user, movie);
    injectHTML(html);
    const widths = await getWidths();
    return widths
};

let barWidths = null;
const debug = true;
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