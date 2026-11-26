"""Selenium driver for activating FMSystems floor sessions."""

import time

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait

options = webdriver.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--remote-debugging-port=9222")
options.add_experimental_option("detach", True)  # noqa: FBT003

print("-- Step 1: Launch the FMSystems page in Chrome --")  # noqa: T201
try:
    driver = webdriver.Chrome(options=options)
    print("Chrome browser launched successfully")  # noqa: T201
except Exception as e:
    print(f"Error launching Chrome: {e!s}")  # noqa: T201
    raise  # Re-raise the exception after printing it

LANDING_PAGE_URL = "https://fmsystems.cmu.edu/FMInteract/ShowDrawingView.aspx?file_code=L0&bldgcode%20floorcode%20optn=116%20%20%20%20%20%20%201%20%20%20&bldgcode=116%20%20%20%20%20%20%20&floorcode=1%20%20%20&act_code=Q#"
print("Navigating to landing page...")  # noqa: T201
try:
    driver.get(LANDING_PAGE_URL)
    print(  # noqa: T201
        f"Already navigated to {driver.current_url}. "
        "Please log in manually in the Chrome window.",
    )
except Exception as e:  # noqa: BLE001
    print(f"Error navigating to URL: {e!s}. Current URL: {driver.current_url}")  # noqa: T201

input("After logging in and seeing the FMSystems UI, press Enter to continue... ")

wait = WebDriverWait(driver, 30)

print("-- Step 2: Simulate Clicks --")  # noqa: T201

building_count = 0
floor_count = 0


def click_building_and_all_floors(
    wait: WebDriverWait[webdriver.Chrome],
    driver: webdriver.Chrome,
    building_label: str,
) -> None:
    """Click a building and all its floors."""
    global building_count, floor_count  # noqa: PLW0603

    floor_links = wait.until(
        ec.presence_of_all_elements_located(
            (
                By.XPATH,
                # Find floors for this building in the nav tree
                (
                    f"//a[contains(normalize-space(.), '{building_label}')]"
                    "/ancestor::div[1]/following-sibling::ul"
                    "//div[contains(@class,'fmi-nav-floorplan')]/a[contains(@class,'rtIn')]"
                ),
            ),
        ),
    )

    if (not floor_links) or (len(floor_links) == 0):
        print(f"No floor links found under {building_label}, skipping.")  # noqa: T201
        return

    building_count += 1  # will not count buildings with zero floors
    floor_count += len(floor_links)

    home_window = driver.current_window_handle

    # Click every floor link one by one
    for idx in range(len(floor_links)):
        current_floor_links = driver.find_elements(
            By.XPATH,
            f"//a[contains(normalize-space(.), '{building_label}')]"
            "/ancestor::div[1]/following-sibling::ul"
            "//div[contains(@class,'fmi-nav-floorplan')]/a[contains(@class,'rtIn')]",
        )

        link = current_floor_links[idx]
        href = link.get_attribute("href")
        label = link.text.strip()

        print(f"Opening floor {label} ({idx + 1}/{len(floor_links)}) -> {href}")  # noqa: T201
        # Open floor in new tab
        driver.execute_script("window.open(arguments[0], '_blank');", href)
        driver.switch_to.window(driver.window_handles[-1])

        # Handle possible modal alert: "Drawing file is not available!"
        try:
            WebDriverWait(driver, 1).until(ec.alert_is_present())
            alert = driver.switch_to.alert
            msg = alert.text
            alert.accept()
            print(f"Skipped floor {label or '(no label)'} due to alert: {msg}")  # noqa: T201
        except TimeoutException:
            # No alert -> give the site a moment to "warm" server-side state
            time.sleep(0.5)

        # close tab and return to main page
        driver.close()
        driver.switch_to.window(home_window)

    print(  # noqa: T201
        f"[DONE] Finished {building_label}; "
        f"Finished {building_count} buildings with {floor_count} floors in total",
    )


def js_click(el: object) -> None:
    """Click an element using JavaScript."""
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
    driver.execute_script("arguments[0].click();", el)


def open_sites_and_expand_main_campus(wait: WebDriverWait[webdriver.Chrome]) -> None:
    """Open sites menu and expand Main Campus section."""
    print("Ensuring Main Campus is expanded next building")  # noqa: T201
    show_menu = WebDriverWait(driver, 3).until(
        ec.element_to_be_clickable((By.CSS_SELECTOR, "a.fmi-nav-2ndnav-show")),
    )
    driver.execute_script("arguments[0].click();", show_menu)
    print("Clicked 'Show Menu'")  # noqa: T201
    time.sleep(0.2)

    campus_plus_xpath = (
        "//div[contains(@class,'rtTop') and "
        ".//a[contains(@class,'rtIn') and "
        "contains(., '00_Main Campus - Excludes Residences')]]"
        "//span[contains(@class,'rtPlus')]"
    )

    # 1. Try to find the plus sign for main campus section
    campus_plus = driver.find_elements(By.XPATH, campus_plus_xpath)

    if campus_plus:
        js_click(campus_plus[0])
        print("Clicked + to expand Main Campus section (already visible)")  # noqa: T201
        return

    # 2. Otherwise click Sites, then find +
    sites_link = wait.until(ec.element_to_be_clickable((By.LINK_TEXT, "Sites")))
    sites_link.click()
    print("Clicked on 'Sites' link")  # noqa: T201

    campus_plus_elem = wait.until(
        ec.element_to_be_clickable((By.XPATH, campus_plus_xpath)),
    )
    js_click(campus_plus_elem)
    print("Clicked + to expand Main Campus section")  # noqa: T201


def expand_building(wait: WebDriverWait[webdriver.Chrome], building_label: str) -> None:
    """Expand a building in the navigation tree."""
    print(f"Expanding '{building_label}'...")  # noqa: T201
    xpath = (
        f"//a[contains(@class,'rtIn') and "
        f"contains(normalize-space(.), '{building_label}')]"
    )
    link_elem = wait.until(
        ec.presence_of_element_located((By.XPATH, xpath)),
    )

    driver.execute_script("arguments[0].scrollIntoView(true);", link_elem)
    time.sleep(0.2)

    plus_xpath = "preceding-sibling::span[contains(@class,'rtPlus')]"
    plus_elements = link_elem.find_elements(By.XPATH, plus_xpath)
    if not plus_elements:
        print(f"'{building_label}' already expanded, skipping.")  # noqa: T201
        return
    driver.execute_script("arguments[0].click();", plus_elements[0])

    print(f"Clicked + to expand {building_label}.")  # noqa: T201
    time.sleep(0.5)


# List of buildings to click. Comment out any buildings you do not wish to process.
buildings_to_process = [
    "Alumni House",
    "ANSYS Hall",
    "Baker-Porter Hall",
    "Bramer House & Garage",
    "College of Fine Arts",
    "Cyert Hall",
    "Dithridge Street Garage",
    "Doherty Hall",
    "East Campus Garage",
    "Elliot Dunlap Smith Hall",
    "Facilities Management Services (040)",
    "Fifth Ave 4721",
    "Fifth Ave 4802",
    "Forbes Ave 4615",
    "Gates and Hillman Centers & Garage",
    "Gesling Stadium",
    "Hall of the Arts",
    "Hamburg Hall",
    "Hamerschlag Hall",
    "Henry St 4616",
    "Henry St 4618",
    "Henry St 4620",
    "Highmark Center for Health, Wellness & Athletics",
    "Hunt Library",
    "Jared L. Cohon University Center",
    "Landscape Support Facility",
    "Margaret Morrison Carnegie Hall",
    "Mellon Institute",
    "Newell-Simon Hall",
    "Posner Center",
    "Posner Hall",
    "Purnell Center for the Arts",
    "Robert Mehrabian CIC",
    "Roberts Engineering Hall",
    "Scott Hall",
    "South Craig St 203",
    "South Craig St 205",
    "South Craig St 300",
    "South Craig St 311",
    "South Craig St 407",
    "South Craig St 417",
    "South Neville Garage",
    "TCS Hall & Garage",
    "Tepper Building & Garage",
    "UTDC",
    "Warner Hall",
    "Wean Hall",
]

open_sites_and_expand_main_campus(wait)
for building_label in buildings_to_process:
    expand_building(wait, building_label)
    click_building_and_all_floors(wait, driver, building_label)
