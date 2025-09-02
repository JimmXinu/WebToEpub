"use strict";

parserFactory.register("mznovels.com", () => new MznovelsParser());

class MznovelsParser extends Parser { // eslint-disable-line no-unused-vars
    constructor() {
        super();
    }

    async getChapterUrls(dom, chapterUrlsUI) {
        let tocPage1chapters = this.extractPartialChapterList(dom);
        let urlsOfTocPages  = this.getUrlsOfTocPages(dom);
        return (await this.getChaptersFromAllTocPages(tocPage1chapters,
            this.extractPartialChapterList,
            urlsOfTocPages,
            chapterUrlsUI
        )).reverse();
    }

    getUrlsOfTocPages(dom) {
        let pagination = dom.querySelector(".pagination");
        let url = new URL(pagination.querySelector("a").href);
        let urls = [];
        let maxPage = this.maxTocPage(pagination);
        for (let i = 2; i <= maxPage; i++) {
            url.searchParams.set("page", i);
            urls.push(url.href);
        }
        return urls;
    }

    maxTocPage(pagination) {
        let offsets = [...pagination.querySelectorAll("a")]
            .map(item => new URL(item?.href)?.searchParams?.get("page"))
            .filter(item => item !== null)
            .map(item => parseInt(item));
        return 0 < offsets.length
            ? Math.max(...offsets)
            : 0;
    }

    extractPartialChapterList(dom) {
        let menu = dom.querySelector(".chapter-list");
        return util.hyperlinksToChapterList(menu);
    }

    findContent(dom) {
        return dom.querySelector(".chapter-content");
    }

    extractTitleImpl(dom) {
        return dom.querySelector(".novel-title");
    }

    extractAuthor(dom) {
        let authorLabel = dom.querySelector(".novel-author a");
        return authorLabel?.textContent ?? super.extractAuthor(dom);
    }

    findChapterTitle(dom) {
        return dom.querySelector("h1");
    }

    findCoverImageUrl(dom) {
        return util.getFirstImgSrc(dom, ".novel-image-container");
    }

    getInformationEpubItemChildNodes(dom) {
        return [...dom.querySelectorAll(".novel-summary")];
    }

    cleanInformationNode(node) {
        util.removeChildElementsMatchingSelector(node, "button");
        return node;
    }
}
