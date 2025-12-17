
const czChars = /[áéíóúůýžščřďťňÁÉÍÓÚŮÝŽŠČŘĎŤŇ]/;
const line = "I make lots of people laugh. smysl pro humor";

const splitMatch = line.match(/^(.*[.!?])\s+(.+)$/);
console.log("Match:", splitMatch);

if (splitMatch) {
    const p1 = splitMatch[1];
    const p2 = splitMatch[2];
    console.log("P1:", p1);
    console.log("P2:", p2);

    const isCz = czChars.test(p2);
    const isLower = /^[a-z]/.test(p2);
    console.log("IsCz:", isCz);
    console.log("IsLower:", isLower);

    if (isCz || isLower) {
        console.log("DECISION: Split!");
    } else {
        console.log("DECISION: Keep as Example");
    }
} else {
    console.log("No Match");
}
