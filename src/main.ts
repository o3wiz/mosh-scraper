import * as puppeteer from "puppeteer";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const MEMBERS_URL: string = process.env.MEMBERS_URL || "";
const COURSE_URL: string = `${MEMBERS_URL}${process.env.COURSE || ""}`;
const COOKIES_PATH: string = process.env.COOKIES_PATH || "";
const ARIA2C_OUTPUT: string = process.env.ARIA2C_OUTPUT || "";

interface Chapter {
    name: string;
    downloadUrl: string;
}

interface Section {
    name: string;
    chapters: Chapter[];
}

interface Course {
    name: string;
    sections: Section[];
}

async function getCourseName(page: puppeteer.Page): Promise<string> {
    const courseTitlePupElement = (await page.$(".course-sidebar-head h2"))!;
    return await courseTitlePupElement.evaluate(element => element.textContent?.trim() || "");
}

async function getSectionName(courseSectionPupElement: puppeteer.ElementHandle<HTMLDivElement>): Promise<string> {
    const sectionTitlePupElement = (await courseSectionPupElement.$("div.section-title"))!;
    return await sectionTitlePupElement.evaluate(element => element.textContent?.trim() || "");
}

async function getChapterName(chapterItemPupElement: puppeteer.ElementHandle<HTMLLIElement>): Promise<string> {
    const chapterNamePupElement = (await chapterItemPupElement.$("span.lecture-name"))!;
    return await chapterNamePupElement.evaluate(element => element.innerText?.trim() || "");
}

async function getChapterDownloadLink(
    chapterItemPupElement: puppeteer.ElementHandle<HTMLLIElement>,
    page: puppeteer.Page
): Promise<string> {
    const chapterUrlItemPupElement = (await chapterItemPupElement.$("a.item[href]"))!;
    await chapterUrlItemPupElement.click();
    await page.waitForNavigation();
    const downloadAnchorButton = await page.waitForSelector("a.download");
    if (downloadAnchorButton) {
        const downloadUrl = await downloadAnchorButton.evaluate(element => element.getAttribute("href"));
        const fullDownloadUrl = `${MEMBERS_URL}${downloadUrl}`;
        return fullDownloadUrl;
    }
    return "";
}

async function getSectionChapters(
    courseSectionPupElement: puppeteer.ElementHandle<HTMLDivElement>,
    page: puppeteer.Page
): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    const chapterListPupElement = (await courseSectionPupElement.$$("ul.section-list li.section-item"))!;
    const isVideoPupElement = async (chapter: puppeteer.ElementHandle<HTMLLIElement>): Promise<boolean> => {
        const usePupElement = (await chapter.$("svg use"))!;
        const xlinkHrefAttribute = (await usePupElement.evaluate(element => element.getAttribute("xlink:href")))!;
        return xlinkHrefAttribute === "#icon__Video";
    };
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    for (const chapterItemPupElement of chapterListPupElement) {
        const isVideo = await isVideoPupElement(chapterItemPupElement);
        if (!isVideo) {
            continue;
        }
        chapters.push({
            name: await getChapterName(chapterItemPupElement),
            downloadUrl: await getChapterDownloadLink(chapterItemPupElement, page),
        });
        await delay(500);
    }
    return chapters;
}

async function getCourseSections(page: puppeteer.Page): Promise<Section[]> {
    const sections: Section[] = [];
    const courseSectionPupElements = (await page.$$("div.course-section"))!;
    for (const courseSectionPupElement of courseSectionPupElements) {
        sections.push({
            name: await getSectionName(courseSectionPupElement),
            chapters: await getSectionChapters(courseSectionPupElement, page),
        });
    }
    return sections;
}

async function getCourse(page: puppeteer.Page): Promise<Course> {
    await page.goto(COURSE_URL);
    const course: Course = {
        name: await getCourseName(page),
        sections: await getCourseSections(page),
    };
    return course;
}

async function loadCookies(cookiesPath: string): Promise<puppeteer.CookieParam[]> {
    const cookiesString = await fs.promises.readFile(cookiesPath, "utf-8")!;
    const cookies: puppeteer.CookieParam[] = JSON.parse(cookiesString);
    return cookies;
}

async function getMoshCourseLinks(): Promise<Course> {
    if (0 === COURSE_URL.length) {
        throw "invalid url";
    }
    const browser = await puppeteer.launch({headless: false, defaultViewport: null});
    const page = await browser.newPage();
    const cookies = await loadCookies(COOKIES_PATH);
    await page.setCookie(...cookies);
    const course = await getCourse(page);
    browser.close();
    return course;
}

function makeAriaLinksFile(course: Course): string[] {
    const toSnakeCase = (s: string): string =>
        s
            .split(" ")
            .map(x => x.toLowerCase())
            .join("_");
    const courseNameModifier = (courseName: string): string => toSnakeCase(courseName);
    const sectionNameModifier = (sectionName: string): string => {
        const sectionNameRegexPattern = new RegExp(/(.*) \(.*$/);
        return sectionName.replace(sectionNameRegexPattern, (_, firstGroup) => toSnakeCase(firstGroup));
    };
    const chapterNameModifier = (chapterName: string): string => {
        const chapterNameRegexPattern = new RegExp(/(\d+)\- (.*) \(.*/);
        return chapterName.replace(
            chapterNameRegexPattern,
            (_, chapterNumber, chapterName) => `${chapterNumber}_${toSnakeCase(chapterName)}`
        );
    };
    const links: string[] = [];
    const courseName = courseNameModifier(course.name);
    for (const [sectionIndex, section] of course.sections.entries()) {
        const sectionNumber = (sectionIndex + 1).toString().padStart(2, '0');
        const sectionName = sectionNameModifier(section.name);
        for (const chapter of section.chapters) {
            const chapterName = chapterNameModifier(chapter.name);
            const downloadUrl = chapter.downloadUrl;
            links.push(`${downloadUrl}\n out=./${courseName}/${sectionNumber}_${sectionName}/${chapterName}.mp4`);
        }
    }
    return links;
}

getMoshCourseLinks()
    .then(course => makeAriaLinksFile(course))
    .then(links => {
        fs.writeFileSync(ARIA2C_OUTPUT, links.join("\n"), "utf8");
    })
    .catch(err => console.error(err));
