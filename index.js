
let portfolio_btn = document.querySelector("#portfolio")

portfolio_btn.addEventListener("click", () => {
    let portfolio_section = document.querySelector("#portfolio-div");
    console.log(portfolio_section);
    portfolio_section.scrollIntoView()
});


document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});


let allAnchorTag = document.querySelectorAll("a")

allAnchorTag.forEach((val) => {

    console.log(val.classList.add("achor_underline"));
});

var typed = new Typed(".profession",{
    strings:["Full Stack Web Developer","UI/UX Designer", "Photographer","Prompt Engineer","Full Stack Web Developer","UI/UX Designer", "Photographer","Prompt Engineer","Full Stack Web Developer","UI/UX Designer", "Photographer","Prompt Engineer"],
    typeSpeed:80,
    backSpeed:10,
    loop:true,
    loopCount:Infinity,
    showCursor:true,
    cursorChar:"|"
})
